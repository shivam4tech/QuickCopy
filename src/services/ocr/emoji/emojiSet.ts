/**
 * Candidate emoji set for the emoji recognizer.
 *
 * The recognizer renders every candidate with the browser's own emoji font
 * and template-matches captured glyphs against it. Keeping a curated set keeps
 * catalog build + matching fast while covering the common cases users hit:
 * smileys / emotions, hearts, gestures, animals, food, symbols, and all real
 * national flags (which are rendered as a single regional-indicator glyph).
 */

const REGIONAL_INDICATOR_BASE = 0x1f1e6; // 🇦

/** Build a flag emoji from its two-letter ISO 3166-1 alpha-2 code. */
export function flagFromCode(code: string): string {
  const upper = code.toUpperCase();
  if (upper.length !== 2) {
    throw new Error(`Invalid country code "${code}" (expected 2 letters)`);
  }
  return String.fromCodePoint(...Array.from(upper).map((c) => REGIONAL_INDICATOR_BASE + (c.charCodeAt(0) - 65)));
}

export const SMILEY_EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🥲', '☺️', '😊', '😇', '🙂', '🙃', '😉', '😌',
  '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸',
  '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢',
  '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔',
  '🫢', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴',
  '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹',
  '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽',
  '🙀', '😿', '😾',
];

export const HEART_EMOJIS = [
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖',
  '💘', '💝', '💟', '♥️', '💌', '💋',
];

export const GESTURE_EMOJIS = [
  '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆',
  '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🤝', '🙏',
  '✍️', '💅', '🤳', '💪', '🦾', '👂', '🦻', '👃', '🧠', '🦷', '🦴', '👀', '👁️', '👅', '👄', '👶',
  '🧒', '👦', '👧', '🧑', '👨', '👩', '🧔', '👱', '🧓', '👴', '👵', '🙍', '🙎', '🙅', '🙆', '💁',
  '🙋', '🧏', '🙇', '🤦', '🤷', '💆', '💇', '🚶', '🏃', '💃', '🕺', '👯', '🧖', '🧗', '🦵', '🦶',
];

export const ANIMAL_EMOJIS = [
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸',
  '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺',
  '🐗', '🐴', '🦄', '🐝', '🪲', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍',
  '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊',
  '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎',
  '🐖', '🐏', '🐑', '🦙', '🦌', '🐕', '🐩', '🦮', '🐈', '🐈⬛', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️',
  '🐇', '🦝', '🦨', '🦡', '🦫', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔', '🐾', '🐉', '🐲',
];

export const PLANT_EMOJIS = [
  '🌵', '🎄', '🌲', '🌳', '🌴', '🌱', '🌿', '☘️', '🍀', '🎍', '🪴', '🎋', '🍃', '🍂', '🍁', '🍄',
  '🐚', '🌾', '💐', '🌷', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🌞', '🌝', '🌛', '🌜', '🌚', '🌕',
  '🌖', '🌗', '🌘', '🌑', '🌒', '🌓', '🌔', '🌙', '🌎', '🌍', '🌏', '🪐', '💫', '⭐', '🌟', '✨',
  '⚡', '☄️', '💥', '🔥', '🌪️', '🌈', '☀️', '🌤️', '⛅', '🌥️', '☁️', '🌦️', '🌧️', '⛈️', '🌩️', '🌨️',
  '❄️', '☃️', '⛄', '🌬️', '💨', '💧', '💦', '☔', '☂️', '🌊', '🌫️',
];

export const FOOD_EMOJIS = [
  '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥',
  '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠',
  '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖',
  '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥫', '🍝',
  '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡',
  '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜',
  '🍯', '🥛', '🍼', '🫖', '☕', '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸',
  '🍹', '🍾', '🧊', '🥄', '🍴', '🍽️', '🥣', '🥡', '🥢', '🧂',
];

export const ACTIVITY_OBJECT_EMOJIS = [
  '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏',
  '⛳', '🏹', '🎣', '🥊', '🥋', '🎽', '🛹', '🛼', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🏆', '🥇', '🥈',
  '🥉', '🏅', '🎖️', '🎫', '🎪', '🤹', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷',
  '🎺', '🎸', '🪕', '🎻', '🎲', '🎯', '🎳', '🎮', '🎰', '🧩', '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️',
  '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🛴', '🚲', '🛵', '🏍️', '🛺', '🚨', '🚔', '🚍',
  '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊',
  '🚉', '✈️', '🛫', '🛬', '🛩️', '💺', '🛰️', '🚀', '🛸', '🚁', '🛶', '⛵', '🚤', '🛥️', '🛳️', '⛴️',
  '🚢', '⚓', '⛽', '🚧', '🚦', '🚥', '🚏', '🗺️', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟️', '🎡', '🎢',
  '🎠', '⛲', '⛱️', '🏖️', '🏝️', '🏜️', '🌋', '⛰️', '🏔️', '🗻', '🏕️', '⛺', '🛖', '🏠', '🏡', '🏘️',
  '🏚️', '🏗️', '🏭', '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏩', '💒', '🏛️', '⛪',
  '🕌', '🕍', '🛕', '🕋', '⛩️', '🛤️', '🛣️', '🗾', '🎑', '🏞️', '🌅', '🌄', '🌠', '🎇', '🎆', '🌇',
  '🌆', '🏙️', '🌃', '🌌', '🌉', '🌁', '⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️',
  '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺',
  '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦',
  '🕯️', '🪔', '🧯', '💸', '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🧰', '🔧', '🔨',
  '⚒️', '🛠️', '⛏️', '🔩', '⚙️', '🧲', '💣', '🧨', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '⚱️', '🏺',
  '🔮', '📿', '🧿', '💈', '🔭', '🔬', '🩹', '🩺', '💊', '💉', '🩸', '🧬', '🦠', '🧫', '🧪', '🌡️',
  '🧹', '🧺', '🧻', '🚽', '🚰', '🚿', '🛁', '🛀', '🧼', '🧽', '🧴', '🛎️', '🔑', '🗝️', '🚪', '🪑',
  '🛋️', '🛏️', '🛌', '🧸', '🪆', '🖼️', '🪞', '🪟', '🛍️', '🛒', '🎁', '🎈', '🎏', '🎀', '🪄', '🎊',
  '🎉', '🎎', '🏮', '🎐', '🧧', '✉️', '📩', '📨', '📧', '📥', '📤', '📦', '🏷️', '🪧', '📪',
  '📫', '📬', '📭', '📮', '📯', '📜', '📃', '📄', '📑', '🧾', '📊', '📈', '📉', '🗒️', '🗓️', '📆',
  '📅', '🗑️', '📇', '🗃️', '🗳️', '🗄️', '📋', '📁', '📂', '🗂️', '🗞️', '📰', '📓', '📔', '📒', '📕',
  '📗', '📘', '📙', '📚', '📖', '🔖', '🧷', '🔗', '📎', '🖇️', '📐', '📏', '🧮', '📌', '📍', '✂️',
  '🖊️', '🖋️', '✒️', '🖌️', '🖍️', '📝', '✏️', '🔍', '🔎', '🔏', '🔐', '🔒', '🔓', '🔔', '🔕', '🎵',
  '🎶', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '🟤', '⚫', '⚪', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪',
  '🟫', '🔺', '🔻', '🔷', '🔶', '🔸', '🔹', '▪️', '▫️', '◾', '◽', '◼️', '◻️', '⬛', '⬜', '🔲',
  '🔳', '🏳️', '🏴', '🏁', '🚩', '🏳️🌈', '🏳️⚧️', '🇺🇳',
];

/** ISO 3166-1 alpha-2 codes with a standard flag emoji (plus 🇺🇳 UN flag). */
export const COUNTRY_FLAG_CODES = [
  'US', 'CA', 'MX', 'GT', 'BZ', 'HN', 'SV', 'NI', 'CR', 'PA', 'CU', 'HT', 'DO', 'JM', 'TT', 'BB',
  'BS', 'GD', 'VC', 'LC', 'DM', 'AG', 'KN', 'CO', 'VE', 'GY', 'SR', 'EC', 'PE', 'BO', 'CL', 'AR',
  'UY', 'PY', 'BR', 'GB', 'IE', 'FR', 'NL', 'BE', 'LU', 'CH', 'AT', 'DE', 'IS', 'DK', 'NO', 'SE',
  'FI', 'EE', 'LV', 'LT', 'PT', 'ES', 'IT', 'MT', 'GR', 'CY', 'TR', 'AD', 'MC', 'SM', 'VA', 'PL',
  'CZ', 'SK', 'HU', 'RO', 'BG', 'AL', 'MK', 'RS', 'HR', 'SI', 'BA', 'ME', 'XK', 'UA', 'BY', 'MD',
  'RU', 'GE', 'AM', 'AZ', 'IL', 'PS', 'JO', 'LB', 'SY', 'IQ', 'IR', 'SA', 'YE', 'OM', 'AE', 'QA',
  'BH', 'KW', 'EG', 'LY', 'TN', 'DZ', 'MA', 'SD', 'SS', 'ER', 'DJ', 'SO', 'ET', 'KE', 'UG', 'TZ',
  'RW', 'BI', 'CD', 'CG', 'GA', 'GQ', 'ST', 'CM', 'NG', 'NE', 'ML', 'BF', 'SN', 'GM', 'GW', 'CV',
  'MR', 'SL', 'LR', 'CI', 'GH', 'TG', 'BJ', 'TD', 'CF', 'ZA', 'ZW', 'MZ', 'MW', 'ZM', 'NA', 'BW',
  'AO', 'MG', 'MU', 'SC', 'KM', 'KZ', 'TM', 'UZ', 'TJ', 'KG', 'MN', 'IN', 'PK', 'BD', 'NP', 'BT',
  'LK', 'MV', 'AF', 'MM', 'TH', 'LA', 'VN', 'KH', 'MY', 'SG', 'ID', 'PH', 'BN', 'TL', 'CN', 'JP',
  'KR', 'KP', 'TW', 'HK', 'MO', 'AU', 'NZ', 'FJ', 'PG', 'SB', 'VU', 'WS', 'TO', 'FM', 'MH', 'PW',
  'NR', 'KI', 'TV',
];

/** Build the flag emoji strings for every supported country code. */
export const FLAG_EMOJIS: string[] = COUNTRY_FLAG_CODES.map(flagFromCode);

export const COMMON_EMOJI_CANDIDATES: string[] = [
  ...SMILEY_EMOJIS,
  ...HEART_EMOJIS,
  ...GESTURE_EMOJIS,
  ...ANIMAL_EMOJIS,
  ...PLANT_EMOJIS,
  ...FOOD_EMOJIS,
  ...ACTIVITY_OBJECT_EMOJIS,
];

/** Every emoji the recognizer can match (common emojis + all supported flags). */
export const ALL_EMOJI_CANDIDATES: string[] = [...COMMON_EMOJI_CANDIDATES, ...FLAG_EMOJIS];

/** Human-readable labels for the flag codes (used for debug/telemetry only). */
export const FLAG_LABELS: Record<string, string> = {
  US: 'United States', CA: 'Canada', MX: 'Mexico', GB: 'United Kingdom', IE: 'Ireland',
  FR: 'France', DE: 'Germany', IT: 'Italy', ES: 'Spain', PT: 'Portugal', NL: 'Netherlands',
  BE: 'Belgium', CH: 'Switzerland', AT: 'Austria', SE: 'Sweden', NO: 'Norway', DK: 'Denmark',
  FI: 'Finland', PL: 'Poland', CZ: 'Czechia', SK: 'Slovakia', HU: 'Hungary', RO: 'Romania',
  BG: 'Bulgaria', GR: 'Greece', RS: 'Serbia', HR: 'Croatia', SI: 'Slovenia', UA: 'Ukraine',
  RU: 'Russia', TR: 'Turkey', IN: 'India', CN: 'China', JP: 'Japan', KR: 'South Korea',
  AU: 'Australia', NZ: 'New Zealand', BR: 'Brazil', AR: 'Argentina', ZA: 'South Africa',
  EG: 'Egypt', SA: 'Saudi Arabia', AE: 'United Arab Emirates', IL: 'Israel',
};
