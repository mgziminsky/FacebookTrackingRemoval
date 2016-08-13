// Standard Options
const fixLinks   = document.getElementById("fixLinks");
const inlineVids = document.getElementById("inlineVids");
const fixVideos  = document.getElementById("fixVideos");
const useStyle   = document.getElementById("useStyle");

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
    "inlineVids": false,
    "fixVideos":  true,
    "useStyle":   true,
    "modStyle":   "border: 1px dashed green"
};
const storage = chrome.storage.local;
function init() {
    storage.get(defaultOptions, function(opts) {
        fixLinks.checked   = opts.fixLinks;
        inlineVids.checked = opts.inlineVids;
        fixVideos.checked  = opts.fixVideos;
        useStyle.checked   = opts.useStyle;
        modStyle.value     = opts.modStyle;

        preview.style.cssText = modStyle.value;

        inlineVids.disabled = !fixLinks.checked;
        modStyle.disabled   = !useStyle.checked;
    });
}
init();
