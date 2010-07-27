importPackage(com.joelhockey.codec);
load("setup.js");
load("WEB-INF/lib/action.js");

function testaction() {
    // setup DB
    var dbconn = DATASOURCE.getConnection();
    DB.dl33t(dbconn, "delete from action");
    DB.dl33t(dbconn, "delete from gp_session");
    DB.insert(dbconn, "insert into action(iin, cin, csn, aid, name, status) values ('0001020304050607', '08090a0b0c0d0e0f', '4082018512930185', 'A000000018434D00', 'getstatus', '01_ready')");
    dbconn.close();
    
    var start = { msgtype: "start", iin: "0001020304050607", cin: "08090a0b0c0d0e0f", cplc: "4082018512930185" };
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
    assertEquals("actions", actions2.msgtype);
    assertEquals(2, actions2.actions.length);
    assertEquals("gp_extauth", actions2.actions[0].id);
    assertEquals("getstatus", actions2.actions[1].name);

    var getstatusid = actions2.actions[1].id;
	var results2 = { msgtype: "results", results: [{ id: "gp_extauth", apdus: ["9000"] }, { id: getstatusid, apdus: ["08a000000018434d00019e9000", "6a88", "07a000000062000101000007a000000062000201000007a000000062000301000007a000000062010101000008a00000006201010101000007a000000062010201000007a000000062020101000007a000000003000001000008a00000001810010601000008a00000001810020101000008a00000001810010101000108a00000001853444106a0000001510001000008a00000001810010801000007a000000003535001000108a0000000035350419000"] }] };
    var actions3 = LIB.action.getActions(id, results2);
    assertEquals("done", actions3.msgtype);
}
