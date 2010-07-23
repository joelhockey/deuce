JSON = {
    stringify: function(obj) {
        return com.joelhockey.codec.JSON.stringify(com.joelhockey.cirrus.RhinoJava.rhino2java(obj));
    },
    parse: function(s) {
        return com.joelhockey.cirrus.RhinoJava.java2rhino(com.joelhockey.codec.JSON.parse(s));
    }        
};

//function test() {
    var json = JSON.stringify({a: {b: [1, null]}});
    print(json);
    var o = JSON.parse(json);
    print(o.a)
//}
