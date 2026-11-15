// Credits: the exact grant line and the NASA / not-NASA split of sources.json (the footer itself is drawn by the UI in src/ui/ui.js).

export const CREDIT_LINE = 'Supported by the Michigan Space Grant Consortium, NASA grant 80NSSC20M0124.';

/** True when a sources.json entry is provided by NASA (providers such as "European Space Agency (not NASA)" are not). */
export const isNasa = (s) => /NASA/.test(s.provider || '') && !/not NASA/i.test(s.provider || '');
