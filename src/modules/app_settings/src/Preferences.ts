import {
  createDefaultPreferenceStorage,
  InMemoryPreferenceStorage,
  PreferenceStorage,
} from "./PreferenceStorage";
import { Machine } from "state_machine/src/Machine";
import { Mode, Alignment } from "constants/src/StateMachineConstants";
import { AspectRatio, Language } from "./Types";

/**
 * Preferences class for managing application settings.
 *
 * Stores user preferences persistently using Valdi's PersistentStore.
 * Default values are used when preferences haven't been set yet.
 *
 * Based on the Python Preferences class from ayab-desktop.
 */
export class Preferences {
  private storage: PreferenceStorage;
  private static readonly STORE_NAME = "ayab_preferences";
  private readonly changeListeners = new Set<() => void>();

  /** App beeps on when false (quietMode muted when true). */
  static readonly DEFAULT_QUIET_MODE = false;
  /** Hardware beeps on when false (firmware muted when true). */
  static readonly DEFAULT_DISABLE_HARDWARE_BEEP = false;

  // Preference keys
  private static readonly KEY_MACHINE = "machine";
  private static readonly KEY_DEFAULT_KNITTING_MODE = "default_knitting_mode";
  private static readonly KEY_DEFAULT_INFINITE_REPEAT =
    "default_infinite_repeat";
  private static readonly KEY_DEFAULT_ALIGNMENT = "default_alignment";
  private static readonly KEY_DEFAULT_KNIT_SIDE_IMAGE =
    "default_knit_side_image";
  private static readonly KEY_ASPECT_RATIO = "aspect_ratio";
  private static readonly KEY_QUIET_MODE = "quiet_mode";
  private static readonly KEY_DISABLE_HARDWARE_BEEP = "disable_hardware_beep";
  private static readonly KEY_LANGUAGE = "language";
  private static readonly KEY_LOWER_DISPLAY_STITCH_WIDTH =
    "lower_display_stitch_width";
  private static readonly KEY_FIRST_RUN_TOUR_COMPLETED =
    "first_run_tour_completed";

  // Cached values
  private _machine?: Machine;
  private _defaultKnittingMode?: Mode;
  private _defaultInfiniteRepeat?: boolean;
  private _defaultAlignment?: Alignment;
  private _defaultKnitSideImage?: boolean;
  private _aspectRatio?: AspectRatio;
  private _quietMode?: boolean;
  private _disableHardwareBeep?: boolean;
  private _language?: Language;
  private _lowerDisplayStitchWidth?: number;
  private _firstRunTourCompleted?: boolean;

  constructor(storage?: PreferenceStorage) {
    this.storage =
      storage ?? createDefaultPreferenceStorage(Preferences.STORE_NAME);
  }

  /** Subscribe to preference mutations (for UI refresh without setState hacks). */
  onChanged(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  private notifyChanged(): void {
    for (const listener of this.changeListeners) {
      listener();
    }
  }

  /**
   * Get the machine preference
   */
  get machine(): Machine {
    if (this._machine === undefined) {
      this._machine = this.getValue(
        Preferences.KEY_MACHINE,
        Machine.KH910_KH950,
      );
    }
    return this._machine;
  }

  set machine(value: Machine) {
    this._machine = value;
    this.setValue(Preferences.KEY_MACHINE, value);
    this.notifyChanged();
  }

  /**
   * Get the default knitting mode preference
   */
  get defaultKnittingMode(): Mode {
    if (this._defaultKnittingMode === undefined) {
      this._defaultKnittingMode = this.getValue(
        Preferences.KEY_DEFAULT_KNITTING_MODE,
        Mode.SINGLEBED,
      );
    }
    return this._defaultKnittingMode;
  }

  set defaultKnittingMode(value: Mode) {
    this._defaultKnittingMode = value;
    this.setValue(Preferences.KEY_DEFAULT_KNITTING_MODE, value);
  }

  /**
   * Get the default infinite repeat preference
   */
  get defaultInfiniteRepeat(): boolean {
    if (this._defaultInfiniteRepeat === undefined) {
      this._defaultInfiniteRepeat = this.getValue(
        Preferences.KEY_DEFAULT_INFINITE_REPEAT,
        false,
      );
    }
    return this._defaultInfiniteRepeat;
  }

  set defaultInfiniteRepeat(value: boolean) {
    this._defaultInfiniteRepeat = value;
    this.setValue(Preferences.KEY_DEFAULT_INFINITE_REPEAT, value);
  }

  /**
   * Get the default alignment preference
   */
  get defaultAlignment(): Alignment {
    if (this._defaultAlignment === undefined) {
      this._defaultAlignment = this.getValue(
        Preferences.KEY_DEFAULT_ALIGNMENT,
        Alignment.CENTER,
      );
    }
    return this._defaultAlignment;
  }

  set defaultAlignment(value: Alignment) {
    this._defaultAlignment = value;
    this.setValue(Preferences.KEY_DEFAULT_ALIGNMENT, value);
  }

  /**
   * Get the default knit side image preference
   */
  get defaultKnitSideImage(): boolean {
    if (this._defaultKnitSideImage === undefined) {
      this._defaultKnitSideImage = this.getValue(
        Preferences.KEY_DEFAULT_KNIT_SIDE_IMAGE,
        false,
      );
    }
    return this._defaultKnitSideImage;
  }

  set defaultKnitSideImage(value: boolean) {
    this._defaultKnitSideImage = value;
    this.setValue(Preferences.KEY_DEFAULT_KNIT_SIDE_IMAGE, value);
  }

  /**
   * Get the aspect ratio preference
   */
  get aspectRatio(): AspectRatio {
    if (this._aspectRatio === undefined) {
      this._aspectRatio = this.getValue(
        Preferences.KEY_ASPECT_RATIO,
        AspectRatio.FAIRISLE,
      );
    }
    return this._aspectRatio;
  }

  set aspectRatio(value: AspectRatio) {
    this._aspectRatio = value;
    this.setValue(Preferences.KEY_ASPECT_RATIO, value);
    this.notifyChanged();
  }

  /**
   * When true, app/UI beeps are muted.
   */
  get quietMode(): boolean {
    if (this._quietMode === undefined) {
      this._quietMode = this.getValue(
        Preferences.KEY_QUIET_MODE,
        Preferences.DEFAULT_QUIET_MODE,
      );
    }
    return this._quietMode;
  }

  set quietMode(value: boolean) {
    this._quietMode = value;
    this.setValue(Preferences.KEY_QUIET_MODE, value);
    this.notifyChanged();
  }

  /**
   * When true, firmware/hardware beeps are disabled during knitting.
   */
  get disableHardwareBeep(): boolean {
    if (this._disableHardwareBeep === undefined) {
      this._disableHardwareBeep = this.getValue(
        Preferences.KEY_DISABLE_HARDWARE_BEEP,
        Preferences.DEFAULT_DISABLE_HARDWARE_BEEP,
      );
    }
    return this._disableHardwareBeep;
  }

  set disableHardwareBeep(value: boolean) {
    this._disableHardwareBeep = value;
    this.setValue(Preferences.KEY_DISABLE_HARDWARE_BEEP, value);
    this.notifyChanged();
  }

  /**
   * Get the language preference
   * Defaults to "en_US" if not set
   */
  get language(): Language {
    if (this._language === undefined) {
      this._language = this.getValue(Preferences.KEY_LANGUAGE, "en_US");
    }
    return this._language;
  }

  set language(value: Language) {
    this._language = value;
    this.setValue(Preferences.KEY_LANGUAGE, value);
  }

  /**
   * Get the lower display stitch width preference
   */
  get lowerDisplayStitchWidth(): number {
    if (this._lowerDisplayStitchWidth === undefined) {
      this._lowerDisplayStitchWidth = this.getValue(
        Preferences.KEY_LOWER_DISPLAY_STITCH_WIDTH,
        20,
      );
    }
    return this._lowerDisplayStitchWidth;
  }

  set lowerDisplayStitchWidth(value: number) {
    this._lowerDisplayStitchWidth = value;
    this.setValue(Preferences.KEY_LOWER_DISPLAY_STITCH_WIDTH, value);
  }

  /** Whether the first-run getting-started tour has been completed or skipped. */
  get firstRunTourCompleted(): boolean {
    if (this._firstRunTourCompleted === undefined) {
      this._firstRunTourCompleted = this.getValue(
        Preferences.KEY_FIRST_RUN_TOUR_COMPLETED,
        false,
      );
    }
    return this._firstRunTourCompleted;
  }

  set firstRunTourCompleted(value: boolean) {
    this._firstRunTourCompleted = value;
    this.setValue(Preferences.KEY_FIRST_RUN_TOUR_COMPLETED, value);
  }

  /**
   * Reset all preferences to their default values except language
   */
  async reset(): Promise<void> {
    this.machine = Machine.KH910_KH950;
    this.defaultKnittingMode = Mode.SINGLEBED;
    this.defaultInfiniteRepeat = false;
    this.defaultAlignment = Alignment.CENTER;
    this.defaultKnitSideImage = false;
    this.aspectRatio = AspectRatio.FAIRISLE;
    this.quietMode = Preferences.DEFAULT_QUIET_MODE;
    this.disableHardwareBeep = Preferences.DEFAULT_DISABLE_HARDWARE_BEEP;
    // Language is NOT reset - it keeps the current value
    this.lowerDisplayStitchWidth = 20;
    this.notifyChanged();
  }

  /**
   * Refresh preferences by clearing cache and reloading from store
   */
  async refresh(): Promise<void> {
    // Clear cached values to force reload from store
    this._machine = undefined;
    this._defaultKnittingMode = undefined;
    this._defaultInfiniteRepeat = undefined;
    this._defaultAlignment = undefined;
    this._defaultKnitSideImage = undefined;
    this._aspectRatio = undefined;
    this._quietMode = undefined;
    this._disableHardwareBeep = undefined;
    this._language = undefined;
    this._lowerDisplayStitchWidth = undefined;
    this._firstRunTourCompleted = undefined;
    await this.loadAllPreferences();
  }

  /**
   * Initialize preferences by loading from persistent store
   * Should be called after construction to load saved preferences
   */
  async initialize(): Promise<void> {
    await this.loadAllPreferences();
  }

  /**
   * Load all preferences from the persistent store
   */
  private async loadAllPreferences(): Promise<void> {
    try {
      this._machine = await this.loadValue(
        Preferences.KEY_MACHINE,
        Machine.KH910_KH950,
      );
      this._defaultKnittingMode = await this.loadValue(
        Preferences.KEY_DEFAULT_KNITTING_MODE,
        Mode.SINGLEBED,
      );
      this._defaultInfiniteRepeat = await this.loadValue(
        Preferences.KEY_DEFAULT_INFINITE_REPEAT,
        false,
      );
      this._defaultAlignment = await this.loadValue(
        Preferences.KEY_DEFAULT_ALIGNMENT,
        Alignment.CENTER,
      );
      this._defaultKnitSideImage = await this.loadValue(
        Preferences.KEY_DEFAULT_KNIT_SIDE_IMAGE,
        false,
      );
      this._aspectRatio = await this.loadValue(
        Preferences.KEY_ASPECT_RATIO,
        AspectRatio.FAIRISLE,
      );
      this._quietMode = await this.loadValue(
        Preferences.KEY_QUIET_MODE,
        Preferences.DEFAULT_QUIET_MODE,
      );
      this._disableHardwareBeep = await this.loadValue(
        Preferences.KEY_DISABLE_HARDWARE_BEEP,
        Preferences.DEFAULT_DISABLE_HARDWARE_BEEP,
      );
      this._language = await this.loadValue(Preferences.KEY_LANGUAGE, "en_US");
      this._lowerDisplayStitchWidth = await this.loadValue(
        Preferences.KEY_LOWER_DISPLAY_STITCH_WIDTH,
        20,
      );
      this._firstRunTourCompleted = await this.loadValue(
        Preferences.KEY_FIRST_RUN_TOUR_COMPLETED,
        false,
      );
    } catch (error) {
      console.error("Failed to load preferences, using defaults:", error);
    }
    this.notifyChanged();
  }

  /**
   * Get a value from the persistent store with a default fallback
   */
  private async loadValue<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const jsonString = await this.storage.fetchString(key);
      if (jsonString) {
        const parsed = JSON.parse(jsonString);
        return parsed as T;
      }
    } catch (error) {
      // If retrieval fails, return default value
      // This is expected if the key doesn't exist yet
    }
    return defaultValue;
  }

  /**
   * Set a value in the persistent store
   */
  private async saveValue<T>(key: string, value: T): Promise<void> {
    try {
      const jsonString = JSON.stringify(value);
      await this.storage.storeString(key, jsonString);
    } catch (error) {
      console.error(`Failed to store preference ${key}:`, error);
      throw error;
    }
  }

  /**
   * Synchronous getter helper that uses cached value or default
   */
  private getValue<T>(key: string, defaultValue: T): T {
    // Return cached value if available, otherwise default
    // This assumes initialize() has been called to load preferences
    return defaultValue;
  }

  /**
   * Synchronous setter helper that updates cache and saves asynchronously
   */
  private setValue<T>(key: string, value: T): void {
    // Save asynchronously but don't wait
    this.saveValue(key, value).catch((error) => {
      console.error(`Failed to store preference ${key}:`, error);
    });
  }
}
