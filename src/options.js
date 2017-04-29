(function() {
    let storage = browser.storage.local;
    function save(input, opts, target = storage) {
        return target.set(opts).then(() => input.setCustomValidity(""), e => {
            input.setCustomValidity(e);
            throw e;
        });
    }

    // Standard Options
    const fixLinks   = document.getElementById("fixLinks");
    const inlineVids = document.getElementById("inlineVids");
    const useStyle   = document.getElementById("useStyle");
    // Expert Options
    const modStyle = document.getElementById("modStyle");
    const preview  = document.getElementById("preview");

    function handleCheckbox() { save(this, {[this.id]: this.checked}).catch(() => this.checked = !this.checked); }
    for (let checkbox of document.querySelectorAll("input[type=checkbox]:not(#enableSync)")) {
        checkbox.addEventListener("change", handleCheckbox);
    }

    function handleRadio() { save(this, {[this.name]: this.value}); }
    for (let checkbox of document.querySelectorAll("input[type=radio]")) {
        checkbox.addEventListener("change", handleRadio);
    }

    fixLinks.addEventListener("change", e => inlineVids.disabled = !e.target.checked);
    useStyle.addEventListener("change", e => modStyle.disabled   = !e.target.checked);

    document.getElementById("reset").addEventListener("click", () => {
        storage.clear()
               .then(browser.storage.local.clear)
               .then(init);
    });

    modStyle.addEventListener("change", e => {
        const target = e.target;
        save(target, {[target.id]: target.value}).then(() => preview.style.cssText = target.value);
    });

    // Local Options
    const enableSync = document.getElementById("enableSync");
    const optNames = Object.keys(defaultOptions);
    const selectedStorage = () => enableSync.checked ? "sync" : "local";

    enableSync.closest("li").classList.toggle("hidden", !browser.storage.sync);
    enableSync.addEventListener("change", () => {
        save(enableSync, {[enableSync.id]: enableSync.checked}, browser.storage.local).then(() => {
            const newStorage = browser.storage[selectedStorage()];
            const oldOpts = newStorage.get();
            const rollback = e => oldOpts.then(opts => save(enableSync, opts, newStorage))
                                         .then(() => Promise.reject(e));

            return newStorage.remove(optNames)
                             .then(() => storage.get(optNames))
                             .then(opts => save(enableSync, opts, newStorage))
                             .catch(rollback);
        }).then(init, () => enableSync.checked = !enableSync.checked);
    });


    function init() {
        return browser.storage.local.get(localOptions).then(localOpts => {
            enableSync.checked = localOpts.enableSync;
            storage = browser.storage[selectedStorage()] || browser.storage.local;

            return storage.get(defaultOptions).then(opts => {
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
            });
        });
    }
    init().then(() => {
        let dirty = false;
        browser.storage.onChanged.addListener(() => dirty = true);
        window.addEventListener("unload", () => { if (dirty) browser.runtime.sendMessage("RELOAD"); });
    });
}());
