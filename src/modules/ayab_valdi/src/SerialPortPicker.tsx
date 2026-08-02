// A module that fetches serial ports and displays them in a picker.
// "Simulation" is always available; network WebSocket devices merge on refresh.

import {
  ADD_WEBSOCKET_LABEL,
  buildPortList,
  connectionStatusForUri,
  entryLabels,
  SELECT_USB_LABEL,
  SerialPortEntry,
  SIMULATION_PORT,
  uriForEntryIndex,
} from "./SerialPortList";

import { StatefulComponent } from "valdi_core/src/Component";
import { Style } from "valdi_core/src/Style";
import { Label, View, Layout } from "valdi_tsx/src/NativeTemplateElements";
import { sansFont, BUTTON_FONT_SMALL } from "constants/src/Typography";
import { Device } from "valdi_core/src/Device";
import {
  SIDEBAR_CARD_BACKGROUND,
  SIDEBAR_CARD_BORDER,
  sidebarCardInnerStyle,
  sidebarCardStyle,
  sidebarHintStyle,
  sidebarSectionLabelStyle,
} from "constants/src/SidebarStyles";
import { ActivePickerConfig } from "constants/src/OptionPickerModal";
import {
  STATUS_IDLE,
  STATUS_NETWORK,
  STATUS_READY,
  STATUS_SIMULATION,
} from "constants/src/UiTheme";
import {
  get_serial_ports,
  request_serial_port,
  refresh_serial_ports,
  requires_usb_permission_prompt,
  prompt_websocket_url,
} from "serial/src/Serial";
import {
  getNetworkServices,
  refreshNetworkServices,
  registerManualWebSocketService,
} from "serial/src/NetworkDiscovery";
import {
  CoreButton,
  CoreButtonColoring,
  CoreButtonSizing,
} from "widgets/src/components/button/CoreButton";

export interface SerialPortPickerViewModel {
  style?: Style<Layout>;
  tourHighlighted?: boolean;
  onChange: (serialPort: string) => void;
  onOpenPicker: (config: ActivePickerConfig) => void;
}

export interface SerialPortPickerState {
  portEntries: SerialPortEntry[];
  selectedSerialPortIndex: number;
  isRefreshing: boolean;
  connectionError?: string;
}

export class SerialPortPicker extends StatefulComponent<
  SerialPortPickerViewModel,
  SerialPortPickerState
> {
  state: SerialPortPickerState = {
    portEntries: [{ label: SIMULATION_PORT, uri: SIMULATION_PORT }],
    selectedSerialPortIndex: 0,
    isRefreshing: false,
  };

  private refreshGeneration = 0;

  onCreate() {
    if (Device.isWeb()) {
      const e2eWs = (
        globalThis as { __E2E_WEBSOCKET_URI__?: string }
      ).__E2E_WEBSOCKET_URI__;
      if (e2eWs) {
        registerManualWebSocketService({ label: e2eWs, uri: e2eWs });
      }
    }
    this.refreshPortList();
    const e2eWs = (globalThis as { __E2E_WEBSOCKET_URI__?: string })
      .__E2E_WEBSOCKET_URI__;
    if (e2eWs) {
      const entries = buildPortList(
        get_serial_ports(),
        requires_usb_permission_prompt(),
        getNetworkServices(),
        Device.isWeb(),
      );
      const wsIndex = entries.findIndex((entry) => entry.uri === e2eWs);
      if (wsIndex >= 0) {
        this.setState({
          portEntries: entries,
          selectedSerialPortIndex: wsIndex,
        });
        this.viewModel.onChange(e2eWs);
        return;
      }
    }
    this.viewModel.onChange(SIMULATION_PORT);
    if (Device.isWeb()) {
      this.handleRefresh();
    }
  }

  onDestroy(): void {
    this.refreshGeneration++;
  }

  private refreshPortList(): void {
    const physicalPorts = get_serial_ports();
    const entries = buildPortList(
      physicalPorts,
      requires_usb_permission_prompt(),
      getNetworkServices(),
      Device.isWeb(),
    );
    const currentUri = uriForEntryIndex(
      this.state.portEntries,
      this.state.selectedSerialPortIndex,
    );
    const newIndex =
      currentUri != null
        ? Math.max(
            0,
            entries.findIndex((entry) => entry.uri === currentUri),
          )
        : 0;

    this.setState({
      portEntries: entries,
      selectedSerialPortIndex: newIndex,
    });
  }

  private handleRefresh = async (): Promise<void> => {
    if (this.state.isRefreshing) {
      return;
    }

    this.setState({ isRefreshing: true });
    const generation = this.refreshGeneration;
    try {
      if (typeof refresh_serial_ports === "function") {
        await refresh_serial_ports();
      }
      await refreshNetworkServices();
      this.refreshPortList();
    } catch (err: unknown) {
      console.error("Error refreshing serial ports:", err);
    } finally {
      if (!this.isDestroyed() && generation === this.refreshGeneration) {
        this.setState({ isRefreshing: false });
      }
    }
  };

  private handlePortChange = async (index: number): Promise<void> => {
    const entry = this.state.portEntries[index];
    if (!entry) {
      return;
    }

    if (requires_usb_permission_prompt() && entry.uri === SELECT_USB_LABEL) {
      const previousIndex = this.state.selectedSerialPortIndex;
      try {
        this.setState({ connectionError: undefined });
        const portName = await request_serial_port();
        if (portName) {
          const entries = buildPortList(
            get_serial_ports(),
            true,
            getNetworkServices(),
            Device.isWeb(),
          );
          const portIndex = entries.findIndex((item) => item.uri === portName);
          this.setState({
            portEntries: entries,
            selectedSerialPortIndex: portIndex >= 0 ? portIndex : 0,
          });
          this.viewModel.onChange(portName);
        } else {
          this.setState({
            selectedSerialPortIndex: previousIndex,
            connectionError:
              "No compatible USB serial interface was found, or Android access was denied. Check OTG/power, reconnect it, and choose Select USB device… again.",
          });
        }
      } catch (err: unknown) {
        console.error("Error requesting serial port:", err);
        this.setState({
          selectedSerialPortIndex: previousIndex,
          connectionError:
            "Android could not open the USB interface. Reconnect it and choose Select USB device… again.",
        });
      }
      return;
    }

    if (entry.uri === ADD_WEBSOCKET_LABEL) {
      const previousIndex = this.state.selectedSerialPortIndex;
      const entered = prompt_websocket_url();
      if (entered && entered.startsWith("ws")) {
        registerManualWebSocketService({ label: entered, uri: entered });
        const entries = buildPortList(
          get_serial_ports(),
          requires_usb_permission_prompt(),
          getNetworkServices(),
          Device.isWeb(),
        );
        const portIndex = entries.findIndex((item) => item.uri === entered);
        this.setState({
          portEntries: entries,
          selectedSerialPortIndex: portIndex >= 0 ? portIndex : 0,
        });
        this.viewModel.onChange(entered);
      } else {
        this.setState({ selectedSerialPortIndex: previousIndex });
      }
      return;
    }

    this.setState({ selectedSerialPortIndex: index });
    this.viewModel.onChange(entry.uri);
  };

  private handleOpenPortPicker = (): void => {
    this.viewModel.onOpenPicker({
      title: "Connection",
      labels: entryLabels(this.state.portEntries),
      selectedIndex: this.state.selectedSerialPortIndex,
      onSelect: this.handlePortChange,
    });
  };

  onRender() {
    const selectedUri = uriForEntryIndex(
      this.state.portEntries,
      this.state.selectedSerialPortIndex,
    );
    const status = connectionStatusForUri(selectedUri);
    const statusColor =
      status.kind === "simulation"
        ? STATUS_SIMULATION
        : status.kind === "ready"
          ? STATUS_READY
          : status.kind === "network"
            ? STATUS_NETWORK
            : STATUS_IDLE;
    const highlighted = this.viewModel.tourHighlighted === true;
    <view
      accessibilityId="checklist-target-connection"
      style={sidebarCardStyle}
      backgroundColor={SIDEBAR_CARD_BACKGROUND}
      borderColor={highlighted ? "#2563EB" : SIDEBAR_CARD_BORDER}
      borderWidth={highlighted ? 2 : 1}
    >
      <layout style={sidebarCardInnerStyle}>
        <layout style={styles.headerRow}>
          <label style={sidebarSectionLabelStyle} value="Connection" />
          <view
            style={styles.statusChip}
            backgroundColor={statusColor}
            accessibilityId="connection-status"
          >
            <label style={styles.statusChipLabel} value={status.label} />
          </view>
        </layout>
        <layout style={styles.pickerRow}>
          <layout style={styles.pickerWrap}>
            <CoreButton
              text={this.state.portEntries[this.state.selectedSerialPortIndex]?.label ?? "Choose connection"}
              onTap={this.handleOpenPortPicker}
              coloring={CoreButtonColoring.SECONDARY}
              sizing={CoreButtonSizing.SMALL}
              font={BUTTON_FONT_SMALL}
              accessibilityId="connection-picker-open"
              width="100%"
            />
          </layout>
          <CoreButton
            text={this.state.isRefreshing ? "…" : "Refresh"}
            onTap={this.handleRefresh}
            coloring={CoreButtonColoring.SECONDARY}
            sizing={CoreButtonSizing.SMALL}
            font={BUTTON_FONT_SMALL}
            accessibilityId="connection-refresh"
          />
        </layout>
        {this.state.connectionError ? (
          <label style={styles.connectionError} value={this.state.connectionError} />
        ) : status.kind === "prompt" ? (
          <label
            style={styles.connectionHint}
            value="Open Connection and choose Select USB device… to grant Android access. Use Refresh after reconnecting."
          />
        ) : undefined}
      </layout>
    </view>;
  }
}

const styles = {
  headerRow: new Style<Layout>({
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  }),
  statusChip: new Style<View>({
    borderRadius: 999,
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 4,
    paddingBottom: 4,
    flexShrink: 0,
  }),
  statusChipLabel: new Style<Label>({
    font: sansFont(12),
    color: "#FFFFFF",
  }),
  pickerRow: new Style<Layout>({
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
  }),
  pickerWrap: new Style<Layout>({
    flexGrow: 1,
    flexShrink: 1,
    marginRight: 8,
  }),
  connectionHint: sidebarHintStyle,
  connectionError: new Style<Label>({
    font: sansFont(13),
    color: "#B42318",
    marginTop: 2,
    marginBottom: 4,
  }),
};
