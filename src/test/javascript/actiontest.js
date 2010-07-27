importPackage(com.joelhockey.codec);
load("setup.js");
load("WEB-INF/lib/action.js");

function testaction() {
    var start = { msgtype: "start", iin: "0001020304050607", cin: "08090a0b0c0d0e0f", csn: "4082018512930185" };
    var id = "test";
    var actions1 = LIB.action.getActions(id, start);
    //{ "msgtype": "actions", "actions": [{ "id": "gp_initupdate", "apdus": ["8050000008db6df969a85d695900"] }] }
    assertEquals("actions", actions1.msgtype);
    assertEquals(1, actions1.actions.length);
    assertEquals("gp_initupdate", actions1.actions[0].id);
    assertEquals(1, actions1.actions[0].apdus.size());
    var initupdate = actions1.actions[0].apdus.get(0);
    assertMatches(/^8050000008[0-9a-f]{16}00$/, Hex.b2s(initupdate));
    
    var keydivdata = "4d004d4d4d4d4d4d4d4d";
    var currentKeyVersion = "01";
    var scpVersion = "02";
    var seqCounter = "0001";
    var hostChallenge = Hex.b2s(Buf.substring(initupdate, 5, 8));
    var cardChallenge = Hex.b2s(Buf.random(6));
    var sw = "9000";

    var crypto = new com.joelhockey.globalplatform.SoftwareCrypto("404142434445464748494a4b4c4d4e4f");
    crypto.deriveSessionKeys(seqCounter);

    // card cryptogram input = host challenge || seq || card challenge || 0x8000000000000000
    var cardCryptogramInput = hostChallenge + seqCounter + cardChallenge + "8000000000000000";

    // cardCryptogram is last 8 bytes of DES-ede-cbc
    var encrypted = crypto.des3cbcSENC(Hex.s2b(cardCryptogramInput));
    var cardCryptogram = Hex.b2s(Buf.substring(encrypted, -8, 8));
    var apdu = keydivdata + currentKeyVersion + scpVersion + seqCounter + cardChallenge + cardCryptogram + sw;
    
    var results1 = { msgtype: "results", results: [{ id: "gp_initupdate", "apdus": [apdu] }] };
    var actions2 = LIB.action.getActions(id, results1);
print(JSON.stringify(actions2))

}
