'use strict';
app.init().then(() => {
    const optionsElem = document.getElementById("options");
    // Standard Options
    const fixLinks   = document.getElementById("fixLinks");
    const inlineVids = document.getElementById("inlineVids");
    const useStyle   = document.getElementById("useStyle");
    // Expert Options
    const modStyle = document.getElementById("modStyle");
    const preview  = document.getElementById("preview");

    function handleCheckbox() { app.options[this.id] = this.checked; }
    for (let checkbox of document.querySelectorAll("input[type=checkbox]")) {
        checkbox.addEventListener("change", handleCheckbox);
    }

    function handleRadio() { app.options[this.name] = this.value; }
    for (let checkbox of document.querySelectorAll("input[type=radio]")) {
        checkbox.addEventListener("change", handleRadio);
    }

    fixLinks.addEventListener("change", e => inlineVids.disabled = !e.target.checked);
    useStyle.addEventListener("change", e => modStyle.disabled   = !e.target.checked);

    document.getElementById("enabled").addEventListener("change", e => optionsElem.classList.toggle("hidden", !e.target.checked));

    document.getElementById("reset").addEventListener("click", () => {
        app.options.reset();
        init();
    });

    modStyle.addEventListener("change", e => {
        const target = e.target;
        app.options[target.id] = target.value;
        preview.style.cssText = target.value;
    });

    function init() {
        const opts = app.options;
        for (let key in opts) {
            const value = opts[key];
            const item = document.getElementById(key);
            if (item) {
                if (item.type === "checkbox")
                    item.checked = value;
                else
                    item.value = value;
            } else {
                const radio = document.querySelector("input[name=" + key + "][value=" + value + "]");
                if (radio)
                    radio.checked = true;
            }
        }

        preview.style.cssText = modStyle.value;

        inlineVids.disabled = !fixLinks.checked;
        modStyle.disabled   = !useStyle.checked;

        optionsElem.classList.toggle("hidden", !opts.enabled);
    }
    init();

    let dirty = false;
    const wasEnabled = app.options.enabled;
    browser.storage.onChanged.addListener(() => dirty = true);
    window.addEventListener("unload", () => {
        if (dirty && (app.options.enabled || wasEnabled))
            browser.runtime.sendMessage("RELOAD");
    });
}, console.log);
