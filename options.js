// Standard Options
const fixLinks   = document.getElementById("fixLinks");
const fixVideos  = document.getElementById("fixVideos");
const delPixeled = document.getElementById("delPixeled");
const useStyle   = document.getElementById("useStyle");

fixLinks.addEventListener("change", function(e) {
    storage.set({"fixLinks": this.checked});
});

fixVideos.addEventListener("change", function(e) {
    storage.set({"fixVideos": this.checked});
});

delPixeled.addEventListener("change", function(e) {
    storage.set({"delPixeled": this.checked});
});

useStyle.addEventListener("change", function(e) {
    storage.set({"useStyle": this.checked});
    modStyle.disabled = !this.checked;
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
    this.visible = !this.visible;
    if (this.visible) {
        expertOpts.style.display = "initial";
        this.innerText = "Hide Expert Options";
    } else {
        expertOpts.style.display = "none";
        this.innerText = "Show Expert Options";
    }
});


// Init
const defaultOptions = {
    "fixLinks":   true,
    "fixVideos":  true,
    "delPixeled": true,
    "useStyle":   true,
    "modStyle":   "border: 1px dashed green"
};
const storage = chrome.storage.sync;
function init() {
    storage.get(defaultOptions, function(opts) {
        fixLinks.checked   = opts.fixLinks;
        fixVideos.checked  = opts.fixVideos;
        delPixeled.checked = opts.delPixeled;
        useStyle.checked   = opts.useStyle;
        modStyle.value     = opts.modStyle;

        preview.style.cssText = modStyle.value;

        modStyle.disabled = !useStyle.checked;
    });
}
init();
