const MODIFIERS = {
    primary: 'Ctrl',
    control: 'Ctrl',
    ctrl: 'Ctrl',
    ctl: 'Ctrl',
    alt: 'Alt',
    mod1: 'Alt',
    shift: 'Shift',
    super: 'Super',
    mod4: 'Super',
    meta: 'Meta',
    hyper: 'Hyper',
};

/** Formats a GTK accelerator such as `<Alt><Shift>x` as `Alt+Shift+X`; returns '' when it is empty or invalid. */
export function formatAccelerator(accelerator) {
    const match = /^((?:<[A-Za-z0-9_]+>)*)([^<>\s]+)$/.exec(typeof accelerator === 'string' ? accelerator.trim() : '');
    if (!match) return '';
    const parts = [];
    for (const [, name] of match[1].matchAll(/<([^>]+)>/g)) {
        const label = MODIFIERS[name.toLowerCase()];
        if (!label) return '';
        if (!parts.includes(label)) parts.push(label);
    }
    const key = match[2];
    // Single characters and F-keys are upper-cased; named keys (Print, space, Page_Up) get a capital and spaces.
    const named = key.length > 1 && !/^[Ff]\d+$/.test(key);
    parts.push(named ? key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : key.toUpperCase());
    return parts.join('+');
}
