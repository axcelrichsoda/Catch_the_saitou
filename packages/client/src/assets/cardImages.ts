import type { CharacterId, DeductionCardId, Identity, RevealCardId } from "@erroroid/shared";

import backAndoroid from "./cards/android/back-androoid.jpg";
import backErroroid from "./cards/android/back-erroroid.jpg";
import ben from "./cards/android/ben.png";
import charlotte from "./cards/android/charlotte.png";
import ivy from "./cards/android/ivy.png";
import lillian from "./cards/android/lillian.png";
import lucas from "./cards/android/lucas.png";
import oliver from "./cards/android/oliver.png";
import saint from "./cards/android/saint.png";

import deductionBack from "./cards/deduction/back.png";
import dataOrganization from "./cards/deduction/dataOrganization.png";
import decisiveEvidence from "./cards/deduction/decisiveEvidence.png";
import evidenceRecovery from "./cards/deduction/evidenceRecovery.png";
import interrogation from "./cards/deduction/interrogation.png";
import mobHysteria from "./cards/deduction/mobHysteria.png";
import motiveGrasp from "./cards/deduction/motiveGrasp.png";
import suspiciousBehavior from "./cards/deduction/suspiciousBehavior.png";
import traceDiscovery from "./cards/deduction/traceDiscovery.png";
import tracking from "./cards/deduction/tracking.png";

import revealFirst from "./cards/reveal/revealFirst.png";
import revealSecond from "./cards/reveal/revealSecond.png";

/** 未オープン時に表示するアンドロイドカードの表面(実物カードの書き起こし)。 */
export const ANDROID_CARD_IMAGES: Readonly<Record<CharacterId, string>> = {
  charlotte,
  lucas,
  ivy,
  ben,
  lillian,
  oliver,
  saint,
};

/** オープン時に表示する正体裏面(ANDOROID/ERROROIDのどちらか)。 */
export const ANDROID_BACK_IMAGES: Readonly<Record<Identity, string>> = {
  ANDOROID: backAndoroid,
  ERROROID: backErroroid,
};

export const DEDUCTION_CARD_IMAGES: Readonly<Record<DeductionCardId, string>> = {
  tracking,
  suspiciousBehavior,
  mobHysteria,
  decisiveEvidence,
  interrogation,
  motiveGrasp,
  traceDiscovery,
  evidenceRecovery,
  dataOrganization,
};

/** 相手の伏せ札(廃棄場に置かれていない手札)を表示する際に使う共通の裏面。 */
export const DEDUCTION_CARD_BACK_IMAGE = deductionBack;

export const REVEAL_CARD_IMAGES: Readonly<Record<RevealCardId, string>> = {
  revealFirst,
  revealSecond,
};
