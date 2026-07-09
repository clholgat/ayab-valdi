/**
 * Interfaces for serial communication and control.
 * These interfaces allow state_machine to depend on serial types without creating circular dependencies.
 */

import { StateMachineState } from './StateMachineConstants';
import { Token } from './SerialConstants';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Machine = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Pattern = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Status = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Preferences = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Carriage = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Direction = any;

/**
 * Interface for serial communication.
 * Implemented by Communication class in serial module.
 */
export interface ICommunication {
    isOpen(): boolean;
    openSerial(uri: string): boolean;
    openSerialAsync(uri: string): Promise<boolean>;
    closeSerial(): void;
    reqInit(machine: Machine): void;
    reqInfo(): void;
    reqStart(startNeedle: number, stopNeedle: number, continuousReporting: boolean, disableHardwareBeep: boolean): void;
    reqTest(): void;
    /** Exit knit/test mode before closing the port (desktop cancel parity). */
    reqQuit(): void;
    update_API6(): [Uint8Array | null, Token, number];
    update_API6_async(): Promise<[Uint8Array | null, Token, number]>;
    cnfLine(lineNumber: number, color: number, flags: number, lineData: Uint8Array): void;
}

/**
 * Interface for control object used by StateMachine.
 * Implemented by Control class in serial module.
 */
export interface IControl {
    com: ICommunication;
    portname: string;
    state: StateMachineState;
    api_version: number;
    initial_carriage: Carriage;
    initial_position: number;
    initial_direction: Direction;
    continuous_reporting: boolean;
    pattern: Pattern;
    prefs: Preferences;
    status: Status;
    machine: Machine;
    start_needle: number;
    end_needle: number;

    func_selector(): boolean;
    check_serial_API6(): [Token, number];
    cnf_line_API6(param: number): boolean;
    cnf_final_line_API6(param: number): void;
}
