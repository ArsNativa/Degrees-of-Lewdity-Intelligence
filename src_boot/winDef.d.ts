import type { SC2DataManager } from '../submodules/ModLoader/dist-BeforeSC2/SC2DataManager';
import type { ModUtils } from '../submodules/ModLoader/dist-BeforeSC2/Utils';

declare global {
  interface Window {
    modUtils: ModUtils;
    modSC2DataManager: SC2DataManager;
    jQuery: JQueryStatic;
    doli: any;
  }

  const $: JQueryStatic;
}
