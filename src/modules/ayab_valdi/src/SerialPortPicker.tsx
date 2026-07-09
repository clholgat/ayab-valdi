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

function isWebSerialSupported(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

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
  SIDEBAR_FIELD_HEIGHT,
} from "constants/src/SidebarStyles";
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
} from "serial/src/Serial";
import {
  getNetworkServices,
  refreshNetworkServices,
  registerManualWebSocketService,
} from "serial/src/NetworkDiscovery";
import { IndexPicker } from "widgets/src/components/pickers/IndexPicker";
import {
  CoreButton,
  CoreButtonColoring,
  CoreButtonSizing,
} from "widgets/src/components/button/CoreButton";

export interface SerialPortPickerViewModel {
  style?: Style<Layout>;
  tourHighlighted?: boolean;
  onChange: (serialPort: string) => void;
}

export interface SerialPortPickerState {
  portEntries: SerialPortEntry[];
  selectedSerialPortIndex: number;
  isRefreshing: boolean;
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
        isWebSerialSupported(),
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
      isWebSerialSupported(),
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

    if (isWebSerialSupported() && entry.uri === SELECT_USB_LABEL) {
      const previousIndex = this.state.selectedSerialPortIndex;
      try {
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
          this.setState({ selectedSerialPortIndex: previousIndex });
        }
      } catch (err: unknown) {
        console.error("Error requesting serial port:", err);
        this.setState({ selectedSerialPortIndex: previousIndex });
      }
      return;
    }

    if (entry.uri === ADD_WEBSOCKET_LABEL) {
      const previousIndex = this.state.selectedSerialPortIndex;
      const entered =
        typeof prompt === "function"
          ? prompt("WebSocket URL (ws://host:port/ws)", "ws://")
          : null;
      if (entered && entered.startsWith("ws")) {
        registerManualWebSocketService({ label: entered, uri: entered });
        const entries = buildPortList(
          get_serial_ports(),
          isWebSerialSupported(),
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

  onRender() {
    const labels = entryLabels(this.state.portEntries);
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
            <IndexPicker
              style={styles.picker}
              index={this.state.selectedSerialPortIndex}
              labels={labels}
              onChange={this.handlePortChange}
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
        {status.kind === "prompt" ? (
          <label
            style={styles.connectionHint}
            value="Choose a USB device or add a network URL, then tap Refresh."
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
  picker: new Style<View>({
    width: "100%",
    height: SIDEBAR_FIELD_HEIGHT,
    flexShrink: 0,
  }),
  connectionHint: sidebarHintStyle,
};
