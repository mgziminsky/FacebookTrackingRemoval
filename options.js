const fixLinks  = document.getElementById("fixLinks");
const fixVideos = document.getElementById("fixVideos");
const useStyle  = document.getElementById("useStyle");
const modStyle  = document.getElementById("modStyle");

const defaultOptions = {
    "fixLinks":  true,
    "fixVideos": true,
    "useStyle":  true,
    "modStyle":  "border: 1px dashed green"
};

const storage = chrome.storage.local;
function init() {
    storage.get(defaultOptions, function(opts) {
        fixLinks.checked  = opts.fixLinks;
        fixVideos.checked = opts.fixVideos;
        useStyle.checked  = opts.useStyle;
        modStyle.value    = opts.modStyle;

        modStyle.style.display = useStyle.checked ? '' : 'none';
    });
}
init();

fixLinks.addEventListener("change", function(e) {
    storage.set({"fixLinks": this.checked});
});

fixVideos.addEventListener("change", function(e) {
    storage.set({"fixVideos": this.checked});
});

useStyle.addEventListener("change", function(e) {
    storage.set({"useStyle": this.checked});
    modStyle.style.display = this.checked ? '' : 'none';
});

modStyle.addEventListener("change", function(e) {
    storage.set({"modStyle": this.value});
});

document.getElementById("reset").addEventListener("click", function(e) {
    storage.clear();
    init();
});
