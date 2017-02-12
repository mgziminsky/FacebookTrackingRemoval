(function(storage) {
    // Standard Options
    const fixLinks   = document.getElementById("fixLinks");
    const inlineVids = document.getElementById("inlineVids");
    const fixVideos  = document.getElementById("fixVideos");
    const delPixeled = document.getElementById("delPixeled");
    const delSuggest = document.getElementById("delSuggest");
    const hideMethod = document.getElementById("hideMethod");
    const useStyle   = document.getElementById("useStyle");
    const logging    = document.getElementById("logging");

    fixLinks.addEventListener("change", function(e) {
        storage.set({"fixLinks": this.checked});
        inlineVids.disabled = !this.checked;
    });

    inlineVids.addEventListener("change", function(e) {
        storage.set({"inlineVids": this.checked});
    });

    fixVideos.addEventListener("change", function(e) {
        storage.set({"fixVideos": this.checked});
    });

    delPixeled.addEventListener("change", function(e) {
        storage.set({"delPixeled": this.checked});
    });

    delSuggest.addEventListener("change", function(e) {
        storage.set({"delSuggest": this.checked});
    });

    hideMethod.querySelectorAll("input").forEach(function(radio){
        radio.addEventListener("change", function(e) {
            storage.set({"hideMethod": this.value});
        });
    });

    useStyle.addEventListener("change", function(e) {
        storage.set({"useStyle": this.checked});
        modStyle.disabled = !this.checked;
    });

    logging.addEventListener("change", function(e) {
        storage.set({"logging": this.checked});
    });

    document.getElementById("reset").addEventListener("click", function(e) {
        storage.clear();
        init();
    });

    // Expert Options
    const modStyle     = document.getElementById("modStyle");
    const preview      = document.getElementById("preview");
    const expertOpts   = document.getElementById("expertOpts");
    const toggleExpert = document.getElementById("toggleExpert");

    modStyle.addEventListener("change", function(e) {
        storage.set({"modStyle": this.value});
        preview.style.cssText = this.value;
    });

    toggleExpert.visible = false;
    toggleExpert.addEventListener("click", function(e) {
        this.firstChild.innerText = (expertOpts.classList.toggle("visible") ? "Hide" : "Show");
    });

    function init() {
        storage.get(defaultOptions, function(opts) {
            fixLinks.checked   = opts.fixLinks;
            inlineVids.checked = opts.inlineVids;
            fixVideos.checked  = opts.fixVideos;
            delPixeled.checked = opts.delPixeled;
            delSuggest.checked = opts.delSuggest;
            useStyle.checked   = opts.useStyle;
            modStyle.value     = opts.modStyle;
            logging.checked    = opts.logging;

            hideMethod.querySelector("input[value=" + opts.hideMethod + "]").checked = true;

            preview.style.cssText = modStyle.value;

            inlineVids.disabled = !fixLinks.checked;
            modStyle.disabled   = !useStyle.checked;
        });
    }
    init();
}(chrome.storage.local));
