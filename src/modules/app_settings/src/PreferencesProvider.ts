import { createProviderComponentWithKeyName } from "valdi_core/src/provider/createProvider";
import { Preferences } from "./Preferences";

export const PreferencesProvider =
  createProviderComponentWithKeyName<Preferences>("AyabPreferences");
