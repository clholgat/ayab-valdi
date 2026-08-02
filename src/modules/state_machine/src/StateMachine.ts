import {
  Operation,
  StateMachineState,
} from "constants/src/StateMachineConstants";
import { Output } from "./Output";
import {
  Token,
  FIRST_SUPPORTED_API_VERSION,
} from "constants/src/SerialConstants";
import { IControl } from "constants/src/Interfaces";

export class StateMachine {
  private static lastRetry: number = 0.0;
  private static readonly WRONG_MACHINE_STATE = 0xef;
  private static readonly FIRST_LINE_GRACE_MS = 250;

  /**
   * API 6 firmware up through 1.0 does not reset Knitter::m_firstRun when a
   * second job starts. In that state it waits until the first carriage pass
   * before requesting line 0. Its cnfLine handler still loads the line buffer
   * before checking whether the line was requested, so preload row 0 as soon
   * as start succeeds. The normal reqLine(0) response remains necessary and
   * harmless when the firmware sends it.
   */
  private static preloadFirstLine(control: IControl): void {
    console.log(
      "[SerialProtocol] cnfStart succeeded; preloading cnfLine(0) for the first carriage pass",
    );
    control.cnf_line_API6(0);
    control.firstLinePreloaded = true;
  }

  private static answerLineRequest(
    control: IControl,
    requestedLine: number,
  ): boolean {
    if (requestedLine === 0 && control.firstLinePreloaded) {
      // The app only preloads after the normal startup-request grace period has
      // elapsed, while the UI still says Preparing. A later request therefore
      // comes from the buggy first turnaround: row 0 has already knitted.
      control.firstLineRowOffset = 1;
      console.log(
        "[SerialProtocol] delayed reqLine(0) after preload; loading pattern row 1",
      );
    }
    const patternLine = requestedLine + (control.firstLineRowOffset ?? 0);
    return control.cnf_line_API6(requestedLine, patternLine);
  }

  private static finishSuccessfulStart(control: IControl): Output {
    const [token, param] = control.check_serial_API6();
    if (token === Token.reqLine) {
      // Normal firmware requests row 0 immediately on entering knit. Handling
      // it here avoids both an unsolicited preload and any row offset.
      const patternFinished = StateMachine.answerLineRequest(control, param);
      control.state = patternFinished
        ? StateMachineState.FINISHING
        : StateMachineState.RUN_KNIT;
    } else {
      StateMachine.preloadFirstLine(control);
      control.state = StateMachineState.RUN_KNIT;
    }
    return Output.PLEASE_KNIT;
  }

  static retry(method: () => void, timeout: number = 0.1): void {
    const currentTime = Date.now() / 1000.0;
    if (currentTime - StateMachine.lastRetry > timeout) {
      StateMachine.lastRetry = currentTime;
      method();
    }
  }

  // Helper to get Promise constructor (polyfilled by Valdi at runtime)
  private static getPromiseConstructor(): any {
    try {
      // eslint-disable-next-line no-eval
      return eval("Promise");
    } catch (e) {
      throw new Error("Promise not available");
    }
  }

  // Helper to create resolved promise
  private static resolvedPromise(value: Output): any {
    return this.getPromiseConstructor().resolve(value);
  }

  // Helper to process cnfInit and transition to next state
  private static processCnfInit(
    control: IControl,
    operation: Operation,
    param: number,
    returnPromise: boolean = false,
  ): Output | any {
    console.log(
      `[SerialProtocol] cnfInit param=${param} operation=${Operation[operation]} ` +
        `stateBefore=${StateMachineState[control.state]}`,
    );
    if (param !== 0) {
      if (param === StateMachine.WRONG_MACHINE_STATE) {
        console.warn(
          "[SerialProtocol] Firmware is still in a previous operation; sending quit before retrying init",
        );
        control.com.reqQuit();
        control.state = StateMachineState.INIT;
        return returnPromise
          ? this.resolvedPromise(Output.INITIALIZING_FIRMWARE)
          : Output.INITIALIZING_FIRMWARE;
      }
      control.state = StateMachineState.FINISHED;
      return returnPromise
        ? this.resolvedPromise(Output.ERROR_INITIALIZING_FIRMWARE)
        : Output.ERROR_INITIALIZING_FIRMWARE;
    }
    // Even if there's an error (param != 0), we still transition to REQUEST_START
    // because the firmware will send indState after cnfInit, and error codes like 4
    // typically mean "wait for carriage" which is what REQUEST_START handles
    // (Logging is handled by Control._log_cnfInit)

    if (operation === Operation.TEST) {
      control.state = StateMachineState.REQUEST_TEST;
      return returnPromise ? this.resolvedPromise(Output.NONE) : Output.NONE;
    } else {
      // operation = Operation.KNIT:
      control.state = StateMachineState.REQUEST_START;
      // Show carriage setup guidance immediately. The async REQUEST_START
      // state may then wait several seconds for indState and cannot emit an
      // intermediate message while that read is pending.
      return returnPromise
        ? this.resolvedPromise(Output.WAIT_FOR_INIT)
        : Output.WAIT_FOR_INIT;
    }
  }

  // Helper to process indState and send reqStart if param is 0
  private static processIndState(control: IControl, param: number): Output {
    console.log(
      `[SerialProtocol] indState param=${param} carriage=${control.status.carriageType} ` +
        `position=${control.status.carriagePosition} direction=${control.status.carriageDirection}`,
    );
    if (param === 0) {
      // record initial position, direction, carriage
      control.initial_carriage = control.status.carriageType;
      control.initial_position = control.status.carriagePosition;
      control.initial_direction = control.status.carriageDirection;
      // set status.active
      control.status.active = control.continuous_reporting;
      // request start
      // For SINGLEBED mode, send the pattern data range (start_needle/end_needle) to the firmware
      // so beeps happen at the edges of the pattern, not the user's selected range
      // For other modes with flanking needles, send the user's range (knit_start_needle/knit_end_needle)
      // Python sends knit_start_needle/knit_end_needle for all modes, but that causes beeps
      // to be too far from the pattern edges in SINGLEBED mode
      const startNeedle = control.start_needle;
      const stopNeedle = control.end_needle - 1; // end_needle is exclusive (like knit_end_needle)
      control.com.reqStart(
        startNeedle,
        stopNeedle,
        control.continuous_reporting,
        control.prefs.disableHardwareBeep,
      );
      control.state = StateMachineState.CONFIRM_START;
      return Output.NONE;
    } else {
      // any value of param other than 0 is some kind of error code
      return Output.WAIT_FOR_INIT;
    }
  }

  static retryAsync(method: () => void, timeout: number = 0.5): any {
    // Async version that waits before calling the method
    // This is useful for version checks where we want to wait longer between retries
    // Returns a Promise that resolves after the delay
    const PromiseConstructor = (function () {
      try {
        // eslint-disable-next-line no-eval
        return eval("Promise");
      } catch (e) {
        throw new Error("Promise not available");
      }
    })();
    const timeoutRef: { id?: any } = {}; // Object to hold timeout reference
    return new PromiseConstructor(function (resolve: any) {
      // Store timeout ID to prevent GC
      timeoutRef.id = setTimeout(function () {
        method();
        resolve();
      }, timeout * 1000); // Convert seconds to milliseconds
    });
  }

  static _API6_connect(control: IControl, operation: Operation): Output {
    // control.logger.debug("State CONNECT");
    if (operation === Operation.KNIT) {
      if (!control.func_selector()) {
        return Output.ERROR_INVALID_SETTINGS;
      }
    }
    console.log("StateMachine._API6_connect: Port name:", control.portname);

    // Python: control.com = Communication() (for non-Simulation ports)
    // In TypeScript, Communication is created in Control.start(), so we just need to open it
    // Python: if not control.com.open_serial(control.portname): return ERROR_SERIAL_PORT
    if (control.portname === "Simulation") {
      control.com.openSerial("Simulation");
      control.state = StateMachineState.VERSION_CHECK;
      control.com.reqInfo();
      return Output.NONE;
    }

    // Communication should already be created by Control.start()
    if (!control.com) {
      console.error(
        "StateMachine._API6_connect: Communication object not created",
      );
      control.state = StateMachineState.FINISHED;
      return Output.ERROR_SERIAL_PORT;
    }

    // Open the serial port (matches Python: control.com.open_serial(control.portname))
    if (!control.com.openSerial(control.portname)) {
      console.error(
        "StateMachine._API6_connect: Could not initiate serial port opening",
      );
      control.state = StateMachineState.FINISHED;
      return Output.ERROR_SERIAL_PORT;
    }

    // Check if port is actually open (on native platforms, this will be true immediately;
    // on web, it might be false if opening is still in progress)
    if (!control.com.isOpen()) {
      // On web, opening is async, so we need to wait for it to complete
      // Return CONNECTING_TO_MACHINE to indicate we're still connecting
      // The state machine loop will call this again and eventually isOpen() will be true
      console.log(
        "StateMachine._API6_connect: Port opening in progress, waiting...",
      );
      return Output.CONNECTING_TO_MACHINE;
    }

    // setup complete
    control.state = StateMachineState.VERSION_CHECK;
    // control.logger.debug("State VERSION_CHECK");
    // Send initial reqInfo when entering VERSION_CHECK state
    console.log("StateMachine._API6_connect: Sending initial reqInfo");
    control.com.reqInfo();
    return Output.NONE;
  }

  static _API6_connect_async(control: IControl, operation: Operation): any {
    console.log("StateMachine._API6_connect_async: Starting connect");
    const PromiseConstructor = (function () {
      try {
        // eslint-disable-next-line no-eval
        return eval("Promise");
      } catch (e) {
        throw new Error("Promise not available");
      }
    })();

    // control.logger.debug("State CONNECT");
    if (operation === Operation.KNIT) {
      if (!control.func_selector()) {
        return PromiseConstructor.resolve(Output.ERROR_INVALID_SETTINGS);
      }
    }
    console.log(
      "StateMachine._API6_connect_async: Port name:",
      control.portname,
    );

    if (control.portname === "Simulation") {
      return (control.com as any).openSerialAsync("Simulation").then(function (
        _opened: boolean,
      ) {
        control.state = StateMachineState.VERSION_CHECK;
        control.com.reqInfo();
        return Output.NONE;
      });
    }

    // Communication should already be created by Control.start()
    if (!control.com) {
      console.error(
        "StateMachine._API6_connect_async: Communication object not created",
      );
      control.state = StateMachineState.FINISHED;
      return PromiseConstructor.resolve(Output.ERROR_SERIAL_PORT);
    }

    // Open the serial port (matches Python: control.com.open_serial(control.portname))
    // Use async version to properly await port opening
    return (control.com as any)
      .openSerialAsync(control.portname)
      .then(function (opened: boolean) {
        if (!opened) {
          console.error(
            "StateMachine._API6_connect_async: Could not open serial port",
          );
          control.state = StateMachineState.FINISHED;
          return Output.ERROR_SERIAL_PORT;
        }

        // Port is now open
        control.state = StateMachineState.VERSION_CHECK;
        console.log(
          "StateMachine._API6_connect_async: Port opened successfully, sending initial reqInfo",
        );
        control.com.reqInfo();
        return Output.NONE;
      })
      .catch(function (err: any) {
        console.error(
          "StateMachine._API6_connect_async: Error opening serial port:",
          err,
        );
        control.state = StateMachineState.FINISHED;
        return Output.ERROR_SERIAL_PORT;
      });
  }

  static _API6_version_check_async(
    control: IControl,
    operation: Operation,
  ): any {
    console.log(
      "StateMachine._API6_version_check_async: Starting version check",
    );
    return (control as any).check_serial_API6_async().then(function (
      result: [Token, number],
    ) {
      const token = result[0];
      const param = result[1];
      console.log(
        "StateMachine._API6_version_check_async: Got result, token:",
        token,
        "param:",
        param,
      );
      if (token === Token.cnfInfo) {
        if (param >= FIRST_SUPPORTED_API_VERSION) {
          console.log(
            "StateMachine._API6_version_check_async: API version OK, moving to INIT",
          );
          control.api_version = param;
          control.state = StateMachineState.INIT;
          // control.logger.debug("State INIT");
          // Note: reqInit will be sent in _API6_init_async if cnfInit is not received
          return Output.NONE;
        } else {
          // control.logger.error(
          //     "Wrong API version: " + param +
          //     ", expected >= " + FIRST_SUPPORTED_API_VERSION
          // );
          console.log(
            "StateMachine._API6_version_check_async: Wrong API version:",
            param,
          );
          return Output.ERROR_WRONG_API;
        }
      }
      // else - no response yet, just return CONNECTING_TO_MACHINE
      // reqInfo was already sent in _API6_connect_async, so just wait for response
      console.log(
        "StateMachine._API6_version_check_async: No response yet, waiting for device",
      );
      return Output.CONNECTING_TO_MACHINE;
    });
  }

  static _API6_version_check(control: IControl, operation: Operation): Output {
    // For now, use sync version but it will poll quickly
    const [token, param] = control.check_serial_API6();
    if (token === Token.cnfInfo) {
      if (param >= FIRST_SUPPORTED_API_VERSION) {
        control.api_version = param;
        control.state = StateMachineState.INIT;
        // control.logger.debug("State INIT");
        control.com.reqInit(control.machine);
        return Output.NONE;
      } else {
        // control.logger.error(
        //     "Wrong API version: " + param +
        //     ", expected >= " + FIRST_SUPPORTED_API_VERSION
        // );
        return Output.ERROR_WRONG_API;
      }
    }
    // else
    StateMachine.retry(() => control.com.reqInfo());
    return Output.CONNECTING_TO_MACHINE;
  }

  static _API6_init_async(control: IControl, operation: Operation): any {
    console.log("StateMachine._API6_init_async: Starting init check");

    // First check if there's already a message queued (synchronous check)
    // This matches Python's behavior: check first, then send reqInit if needed
    const [queuedToken, queuedParam] = control.check_serial_API6();
    if (queuedToken === Token.cnfInit) {
      if (queuedParam !== 0) {
        return StateMachine.processCnfInit(
          control,
          operation,
          queuedParam,
          true,
        );
      }
      console.log(
        "StateMachine._API6_init_async: Found cnfInit in queue, processing",
      );
      // After getting cnfInit, check if indState is already in the buffer
      console.log(
        "StateMachine._API6_init_async: Checking for indState in buffer after cnfInit",
      );
      const [nextToken, nextParam] = control.check_serial_API6();
      if (nextToken === Token.indState) {
        console.log(
          "StateMachine._API6_init_async: Found indState in buffer immediately after cnfInit!",
        );
        StateMachine.processCnfInit(control, operation, queuedParam);
        StateMachine.processIndState(control, nextParam);
        return StateMachine.resolvedPromise(Output.WAIT_FOR_INIT);
      }
      return StateMachine.processCnfInit(control, operation, queuedParam, true);
    }

    // No cnfInit in queue - send reqInit (matches Python 1.0.0: sends reqInit in _API6_init if cnfInit not received)
    console.log(
      "StateMachine._API6_init_async: No cnfInit in queue, sending reqInit",
    );
    control.com.reqInit(control.machine);

    // Now wait for cnfInit response
    return (control as any).check_serial_API6_async().then(function (
      result: [Token, number],
    ) {
      const token = result[0];
      const param = result[1];
      if (token === Token.cnfInit) {
        console.log(
          "StateMachine._API6_init_async: Received cnfInit after reqInit",
        );
        if (param !== 0) {
          return StateMachine.processCnfInit(
            control,
            operation,
            param,
            true,
          );
        }
        const [nextToken, nextParam] = control.check_serial_API6();
        if (nextToken === Token.indState) {
          StateMachine.processCnfInit(control, operation, param);
          StateMachine.processIndState(control, nextParam);
          return StateMachine.resolvedPromise(Output.WAIT_FOR_INIT);
        }
        return StateMachine.processCnfInit(control, operation, param, true);
      }
      // else - no response yet, keep waiting (shouldn't happen if blocking works correctly)
      console.log(
        "StateMachine._API6_init_async: Still no cnfInit, continuing to wait",
      );
      return Output.INITIALIZING_FIRMWARE;
    });
  }

  static _API6_init(control: IControl, operation: Operation): Output {
    const [token, param] = control.check_serial_API6();
    if (token === Token.cnfInit) {
      return StateMachine.processCnfInit(control, operation, param);
    }
    // Match init_async: request firmware init when cnfInit has not arrived yet.
    control.com.reqInit(control.machine);
    return Output.INITIALIZING_FIRMWARE;
  }

  static _API6_request_start_async(
    control: IControl,
    operation: Operation,
  ): any {
    console.log(
      "StateMachine._API6_request_start_async: Starting request start check - waiting up to 5000ms for data",
    );

    // Wait up to 5000ms (5 seconds) for data to arrive
    // This gives plenty of time for hardware responses, especially for carriage detection
    // which may take several seconds as the user moves the carriage
    // Note: Python's read() blocks for 0.1s per call, but the state machine keeps polling
    const PromiseConstructor = StateMachine.getPromiseConstructor();
    const timeoutMs = 5000; // Wait 5000ms (5 seconds) for hardware responses

    // First check synchronously for immediate data (non-blocking)
    const [immediateToken, immediateParam] = control.check_serial_API6();
    console.log(
      `[SerialProtocol] REQUEST_START immediate token=${Token[immediateToken]} param=${immediateParam}`,
    );
    if (immediateToken === Token.indState) {
      console.log(
        "StateMachine._API6_request_start_async: Found indState immediately",
      );
      const result = StateMachine.processIndState(control, immediateParam);
      return StateMachine.resolvedPromise(result);
    }

    // No immediate data - wait up to timeoutMs for data to arrive asynchronously
    return new PromiseConstructor(function (resolve: any) {
      let resolved = false;

      // Get setTimeout/clearTimeout with proper fallback and context
      const originalTiming = (globalThis as any).__originalTimingFunctions__;
      const setTimeoutFn = originalTiming?.setTimeout || setTimeout;
      const clearTimeoutFn = originalTiming?.clearTimeout || clearTimeout;

      // Bind setTimeout to globalThis to avoid "Illegal invocation" error
      const boundSetTimeout = setTimeoutFn.bind(globalThis);
      const boundClearTimeout = clearTimeoutFn.bind(globalThis);

      const timeoutId = boundSetTimeout(function () {
        if (!resolved) {
          resolved = true;
          console.log(
            "StateMachine._API6_request_start_async: Timeout after",
            timeoutMs,
            "ms, no indState found",
          );
          resolve(StateMachine.resolvedPromise(Output.WAIT_FOR_INIT));
        }
      }, timeoutMs);

      // Check asynchronously for data (this will wait until data arrives or timeout)
      (control as any)
        .check_serial_API6_async()
        .then(function (result: [Token, number]) {
          if (!resolved) {
            resolved = true;
            boundClearTimeout(timeoutId);
            const token = result[0];
            const param = result[1];
            console.log(
              `[SerialProtocol] REQUEST_START async token=${Token[token]} param=${param}`,
            );

            if (token === Token.indState) {
              console.log(
                "StateMachine._API6_request_start_async: Found indState after async wait",
              );
              const result2 = StateMachine.processIndState(control, param);
              resolve(StateMachine.resolvedPromise(result2));
            } else {
              console.log(
                "StateMachine._API6_request_start_async: No indState found after async wait, token:",
                token,
              );
              resolve(StateMachine.resolvedPromise(Output.WAIT_FOR_INIT));
            }
          }
        })
        .catch(function (err: any) {
          if (!resolved) {
            resolved = true;
            boundClearTimeout(timeoutId);
            console.error(
              "StateMachine._API6_request_start_async: Error in async check:",
              err,
            );
            resolve(StateMachine.resolvedPromise(Output.WAIT_FOR_INIT));
          }
        });
    });
  }

  static _API6_request_start(control: IControl, operation: Operation): Output {
    const [token, param] = control.check_serial_API6();
    if (token === Token.indState) {
      return StateMachine.processIndState(control, param);
    }
    return Output.WAIT_FOR_INIT;
  }

  static _API6_confirm_start_async(
    control: IControl,
    operation: Operation,
  ): any {
    console.log(
      "StateMachine._API6_confirm_start_async: Waiting for cnfStart response",
    );
    return (control as any).check_serial_API6_async().then(function (
      result: [Token, number],
    ) {
      const token = result[0];
      const param = result[1];
      console.log(
        `[SerialProtocol] CONFIRM_START token=${Token[token]} param=${param}`,
      );
      if (token === Token.cnfStart) {
        if (param === 0) {
          const originalTiming = (globalThis as any).__originalTimingFunctions__;
          const setTimeoutFn = originalTiming?.setTimeout || setTimeout;
          const boundSetTimeout = setTimeoutFn.bind(globalThis);
          return new (StateMachine.getPromiseConstructor())(
            function (resolve: (output: Output) => void) {
              // Keep the UI in Preparing while normal firmware has a chance
              // to place its immediate reqLine(0) in the receive buffer.
              boundSetTimeout(function () {
                resolve(StateMachine.finishSuccessfulStart(control));
              }, StateMachine.FIRST_LINE_GRACE_MS);
            },
          );
        } else {
          // any value of param other than 0 is some kind of error code
          console.error(
            "StateMachine._API6_confirm_start_async: Device not ready, returned cnfStart with error code",
            param,
          );
          return Output.DEVICE_NOT_READY;
        }
      }
      // else - continue waiting
      return Output.NONE;
    });
  }

  static _API6_confirm_start(control: IControl, operation: Operation): Output {
    const [token, param] = control.check_serial_API6();
    if (token === Token.cnfStart) {
      if (param === 0) {
        return StateMachine.finishSuccessfulStart(control);
      } else {
        // any value of param other than 0 is some kind of error code
        // control.logger.error(
        //     "Device not ready, returned `cnfStart` with error code " + param
        // );
        // TODO: more output to describe error
        return Output.DEVICE_NOT_READY;
      }
    }
    // else
    return Output.NONE;
  }

  static _API6_run_knit(control: IControl, operation: Operation): Output {
    const [token, param] = control.check_serial_API6();
    if (token === Token.reqLine) {
      const pattern_finished = StateMachine.answerLineRequest(control, param);
      if (pattern_finished) {
        control.state = StateMachineState.FINISHING;
        return Output.NEXT_LINE;
      } else {
        return Output.NEXT_LINE;
      }
    }
    // else
    return Output.NONE;
  }

  static _API6_run_knit_async(control: IControl, operation: Operation): any {
    const PromiseConstructor = (function () {
      try {
        // eslint-disable-next-line no-eval
        return eval("Promise");
      } catch (e) {
        throw new Error("Promise not available");
      }
    })();
    return (control as any).check_serial_API6_async().then(function (
      result: [Token, number],
    ) {
      const token = result[0];
      const param = result[1];
      if (token === Token.reqLine) {
        console.log(
          "[JS] StateMachine RUN_KNIT: received reqLine(" + param + ")",
        );
        const pattern_finished = StateMachine.answerLineRequest(control, param);
        if (pattern_finished) {
          control.state = StateMachineState.FINISHING;
          return Output.NEXT_LINE;
        } else {
          return Output.NEXT_LINE;
        }
      }
      // else
      return Output.NONE;
    });
  }

  static _API6_request_test(control: IControl, operation: Operation): Output {
    control.com.reqTest();
    control.state = StateMachineState.CONFIRM_TEST;
    // control.logger.debug("State CONFIRM_TEST");
    return Output.NONE;
  }

  static _API6_confirm_test(control: IControl, operation: Operation): Output {
    const [token, param] = control.check_serial_API6();
    if (token === Token.cnfTest) {
      if (param === 0) {
        // control.emit_hw_test_starter(control);
        control.state = StateMachineState.RUN_TEST;
        // control.logger.debug("State RUN_TEST");
        // TODO: need more informative messages for HW test
        return Output.NONE;
      } else {
        // any value of param other than 0 is some kind of error code
        // control.logger.error(
        //     "Device not ready, returned `cnfTest` with error code " + param
        // );
        // TODO: more output to describe error
        return Output.DEVICE_NOT_READY;
      }
    }
    // else
    return Output.NONE;
  }

  static _API6_run_test(control: IControl, operation: Operation): Output {
    // Any incoming testRes messages are processed in check_serial_API6,
    // there is nothing more to do here.
    control.check_serial_API6();
    return Output.NONE;
  }

  static _API6_finishing(control: IControl, operation: Operation): Output {
    const [token, param] = control.check_serial_API6();
    if (token === Token.reqLine) {
      control.cnf_final_line_API6(param);

      // When closing the serial port, the final bytes written
      // may be dropped by the driver
      // (see https://github.com/serialport/serialport-rs/issues/117).
      // This may cause the final `cnfLine` response to get lost and the
      // firmware to get stuck knitting the previous row
      // (see https://github.com/AllYarnsAreBeautiful/ayab-desktop/issues/662).
      // To avoid this, before closing the port, we send a `reqInfo` message
      // to the firmware and wait for the response.
      control.com.reqInfo();
      control.state = StateMachineState.DISCONNECT;
      // control.logger.debug("State DISCONNECT");
      return Output.DISCONNECTING_FROM_MACHINE;
    }
    // else
    return Output.NONE;
  }

  static _API6_disconnect(control: IControl, operation: Operation): Output {
    const [token, _] = control.check_serial_API6();
    if (token === Token.cnfInfo) {
      // We received a response to our final `reqInfo` request,
      // it is now safe to close the port.
      control.state = StateMachineState.FINISHED;
      return Output.KNITTING_FINISHED;
    }
    // else
    return Output.NONE;
  }

  static _API6_finished(control: IControl, operation: Operation): Output {
    // control.logger.debug("State FINISHED");
    return Output.NONE;
  }
}
