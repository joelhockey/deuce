// initialize cryptoki
com.joelhockey.jacknji11.C.Initialize();

LIB.action = {
    // switch between start and results
    getActions: function (id, data) {
        switch (data.msgtype) {
        case "start":
            return this.startActions(id, data);
        case "results":
            return this.getNextActions(id, data);
        default:
            return { msgtype: "error", error: "unknown msgtype: [" + data.msgtype + "]" };
        }
    },
    
    // start new session
    startActions: function (id, data) {
        // ensure iin, cin, csn included
        if (!data.iin || !data.cin || !data.csn) {
            return { msgtype: "error", error: 
                printf("Invalid start request, require iin, cin, csn.  Got iin=%s, cin=%s, csn=%s",
                       data.iin, data.cin, data.csn) };
        }
        var dbconn = DATASOURCE.getConnection();
        try {
            var hostChallenge = com.joelhockey.codec.Buf.random(8);
            var count = DB.insert(dbconn,
"insert into gp_session (session_id, last_accessed_at, iin, cin, csn, status, host_challenge) \
  ( select ?, ?, ?, ?, ?, '02_initupdate', ? from dual where not exists \
    ( select null from gp_session where session_id=? ) \
  )",
[id, new java.util.Date(), data.iin, data.cin, data.csn, hostChallenge, id]);
            if (count === 0) {
                return { msgtype: "error", error: "session already started for id: " + id };
            }
            var apdus = new com.joelhockey.globalplatform.Messages().initializeUpdate(0, hostChallenge);
            return { msgtype: "actions", actions: [{ id: "gp_initupdate", apdus: apdus }] }
        } catch (e) {
            log.error("Error in startActions", e.javaException || e.rhinoException || null);
            return { msgtype: "error", error: "could not start actions: " + e};
        } finally {
            dbconn.close();
        }
    },
    
    // get next actions to send
    getNextActions: function (id, results) {
    	if (!results || results.msgtype !== "results" || !results.results || results.results.length <= 0) {
            return { msgtype: "error", error: "expected msgtype=results, got: " + JSON.stringify(results)};
    	}
    	
        // get gp session details from DB, ensure scp02 started
        // once gp session is running, send actions
        var dbconn = DATASOURCE.getConnection();
        try {
            // get gp session
            var stmtRs = DB.select(dbconn, "select iin, cin, csn, status, host_challenge, enc, mac, seq_counter, mac_iv, p11_slot_id, p11_session_id, p11_static_enc, p11_static_mac, p11_static_dek, p11_session_cmac_des1, p11_session_cmac_des3, p11_session_senc, p11_session_dek from gp_session where session_id=?", [id]);
            var rs = stmtRs.getResultSet();
            if (!rs.next()) {
                log.warn("no session for " + id);
                return { msgtype: "error", error: "No gp session for " + id};
            }
            
            // create P11Crypto object if needed
            var p11crypto = null;
            var csn = rs.getString("csn");
            var status = String(rs.getString("status"));
            log.debug("gp status for session " + id + ": " + status);
            switch (status) { // need to convert java string to js
                case "02_initupdate":
                    p11crypto = new com.joelhockey.globalplatform.P11Crypto("GP", "password", "isk");
                    break;
                case "03_established":
                    p11crypto = new com.joelhockey.globalplatform.P11Crypto(
                        rs.getInteger("seq_counter"),
                        Hex.s2b(rs.getString("mac_iv")),
                        rs.getInteger("p11_session_id"),
                        rs.getInteger("p11_static_enc"),
                        rs.getInteger("p11_static_mac"),
                        rs.getInteger("p11_static_dek"),
                        rs.getInteger("p11_session_cmac_des1"),
                        rs.getInteger("p11_session_cmac_des3"),
                        rs.getInteger("p11_session_senc"),
                        rs.getInteger("p11_session_dek"));
                    break;
                default:
                    // nothing
            }
            
            // create GP Messages
            var enc = rs.getBoolean("enc");
            var mac = rs.getBoolean("mac");
            var hostChallenge = rs.getString("host_challenge");
            stmtRs.close();
            var gp = new com.joelhockey.globalplatform.Messages(p11crypto, enc, mac);
            
            // nextActions to return
            var nextActions = { msgtype: "actions", actions: [] };
            
            // if gp status is '02_initupdate', then complete with extauth
            if (status === "02_initupdate") {
                // TODO: check results contains only single gp_initupdate
            	if (results.results.length !== 1 || results.results[0].id !== "gp_initupdate" || !results.results[0].apdus || results.results[0].apdus.length !== 1) {
                    return { msgtype: "error", error: "expected gp_initupdate result with single apdu, got: " + JSON.stringify(results)};
            	}
            	var initupdateres = results.results[0].apdus[0];
            	var apdus = gp.externalAuthenticate(false, true, Hex.s2b(hostChallenge), Hex.s2b(initupdateres)); 
            	nextActions.actions.push({ id: "gp_extauth", apdus: apdus });
                DB.update(dbconn,
"update gp_session set \
  last_accessed_at=?,\
  status='03_established',\
  enc=?,\
  mac=?,\
  seq_counter=?,\
  mac_iv=?,\
  p11_slot_id=?,\
  p11_session_id=?,\
  p11_static_enc=?,\
  p11_static_mac=?,\
  p11_static_dek=?,\
  p11_session_cmac_des1=?,\
  p11_session_cmac_des3=?,\
  p11_session_senc=?,\
  p11_session_dek=? \
where session_id=? and status='02_init_update'", [
    java.util.Date(),
    gp.useEncrypt,
    gp.useMAC,
    p11crypto.seqCounter,
    p11crypto.macIV,
    p11crypto.slotID,
    p11crypto.session,
    p11crypto.staticENC,
    p11crypto.staticMAC,
    p11crypto.staticDEK,
    p11crypto.sessionCMACdes1,
    p11crypto.sessionCMACdes3,
    p11crypto.sessionSENC,
    p11crypto.sessionDEK,
    id
]);
            } else {
                DB.update(dbconn, "update gp_session set last_accessed_at=? where session_id=?", [java.util.Date(), id]);
            }
            
            // TODO: handle results
            
            stmtRs = DB.select(dbconn,
"select id, version, aid, name, status \
from action \
where csn=? and status='01_ready' \
order by id",
[csn]);
            rs = stmtRs.getResultSet();
            while (rs.next()) {
                // add to result, update status
                var name = String(rs.getString("name"));
                switch (name) { // need to convert java string to js
                case "getstatus":
                	// flatten GET-STATUS apdus
                	var apdus = []
                    var getstatus = gp.getStatus();
                	for (var i = 0; i < getstatus.size(); i++) {
                		var apdulist = getstatus.get(i);
                		for (var j = 0; j < apdulist.size(); j++) {
                			apdus.push(apdulist.get(j));
                		}
                	}
                    nextActions.actions.push({ id: rs.getString("id"), apdus: apdus });
                    break;
                default:
                    log.error("unknown action name: [" + name + "]");
                    break;
                }
            }
            
            stmtRs.close();
            return nextActions;
        } finally {
            dbconn.close();
        }
        
    }
};