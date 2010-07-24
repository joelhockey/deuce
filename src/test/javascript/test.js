load("setup.js");

function test() {
    var json = JSON.stringify({a: "a", b: {c: [1, null]}});
    var o = JSON.parse(json);
}
