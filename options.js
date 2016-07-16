var storage = chrome.storage.local;
var outlineCheckbox = document.getElementById("showOutline");

storage.get({"showOutline": true}, function(opts){ outlineCheckbox.checked = opts.showOutline; });
outlineCheckbox.addEventListener("change", function(e) {
    storage.set({"showOutline": this.checked});
});
