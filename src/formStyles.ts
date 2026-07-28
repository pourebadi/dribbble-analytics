/**
 * Shared form-control tokens.
 *
 * Inputs, selects, pickers and buttons were each styled at their call site,
 * which left the search box, the tag filter, the shot picker and the date
 * pickers at slightly different heights and radii sitting side by side in the
 * same toolbar. Everything interactive now composes from these constants so a
 * row of controls lines up exactly.
 *
 * The height is fixed rather than derived from padding, because a <select>, an
 * <input> and a <button> compute their intrinsic height differently from the
 * same padding values.
 */

/** Uniform control height for every form element in a toolbar row. */
const CONTROL_H = 'h-9';

/** Base chrome shared by inputs, selects and picker triggers. */
const CONTROL_BASE =
  `${CONTROL_H} text-xs bg-white border border-slate-200 rounded-xl outline-none ` +
  'transition-all text-slate-700 focus:ring-2 focus:ring-pink-200 focus:border-pink-400';

/** Plain text input. */
export const INPUT = `${CONTROL_BASE} px-3 w-full`;

/** Input with a leading icon (icon absolutely positioned at left-3). */
export const INPUT_WITH_ICON = `${CONTROL_BASE} pl-9 pr-3 w-full`;

/** Native select with a leading icon and custom chevron. */
export const SELECT_WITH_ICON =
  `${CONTROL_BASE} pl-8 pr-8 w-full appearance-none font-semibold cursor-pointer`;

/** Trigger button for the custom pickers (shot picker, date picker). */
export const PICKER_TRIGGER =
  `${CONTROL_H} w-full flex items-center gap-2.5 px-2.5 bg-white border rounded-xl ` +
  'transition-all text-left border-slate-200 hover:border-pink-200';

export const PICKER_TRIGGER_OPEN = 'border-pink-300 ring-2 ring-pink-100';

/** Secondary/ghost button matching control height. */
export const BTN_GHOST =
  `${CONTROL_H} px-4 text-xs font-semibold border border-slate-200 text-slate-500 ` +
  'hover:text-slate-700 hover:bg-slate-50 rounded-xl flex items-center gap-1.5 transition-all';

/** Primary action button matching control height. */
export const BTN_PRIMARY =
  `${CONTROL_H} px-4 pink-gradient text-white text-xs font-bold rounded-xl ` +
  'flex items-center gap-1.5 hover:brightness-105 transition-all shadow-sm shadow-pink-200/50 ' +
  'disabled:opacity-40 disabled:hover:brightness-100';

