load("setup.js");

function test() {
    var json = JSON.stringify({a: "a", b: {c: [1, null]}});
    assertEquals('{ "a": "a", "b": { "c": [1, null] } }', json);
    var o = JSON.parse(json);
    assertEquals('a', o.a);
    assertEquals(2, o.b.c.length);
    assertEquals(1, o.b.c[0]);
    assertEquals(null, o.b.c[1]);
}
