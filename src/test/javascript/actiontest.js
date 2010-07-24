load("setup.js");
load("WEB-INF/lib/action.js");

function testaction() {
    var start = {msgtype: "start", iin: "0001020304050607", cin: "08090a0b0c0d0e0f", csn: "4082018512930185"};
    var id = "test";
    var actions1 = LIB.action.getActions(id, start);
    print(JSON.stringify(actions1));
}