// initialize cryptoki
com.joelhockey.jacknji11.C.Initialize();

MODELS.action = {
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
        try {
            var hostChallenge = Buf.random(8);
            var count = DB.insert(
"insert into gp_session (session_id, last_accessed_at, iin, cin, csn, status, host_challenge) \
  ( select ?, ?, ?, ?, ?, '02_initupdate', ? from dual where not exists \
    ( select null from gp_session where session_id=? ) \
  )",
[id, new java.util.Date(), data.iin, data.cin, data.csn, hostChallenge, id]);
            if (count === 0) {
                log.warn("session already started for id: " + id);
                return { msgtype: "error", error: "session already started for id: " + id };
            }
            var apdus = new com.joelhockey.globalplatform.Messages().initializeUpdate(0, hostChallenge);
            return { msgtype: "actions", actions: [{ id: "gp_initupdate", name: "gp_initupdate", apdus: apdus }] }
        } catch (e) {
            log.error("Error in startActions", e.javaException || e.rhinoException || null);
            return { msgtype: "error", error: "could not start actions: " + e};
        }
    },
    
    // get next actions to send
    getNextActions: function (id, results) {
    	if (!results || results.msgtype !== "results" || !results.results || results.results.length <= 0) {
            return { msgtype: "error", error: "expected msgtype=results, got: " + JSON.stringify(results)};
    	}
    	
        // get gp session details from DB, ensure scp02 started
        // once gp session is running, send actions
        // get gp session
        var stmtRs = DB.select("select iin, cin, csn, status, host_challenge, enc, mac, seq_counter, mac_iv, p11_slot_id, p11_session_id, p11_static_enc, p11_static_mac, p11_static_dek, p11_session_cmac_des1, p11_session_cmac_des3, p11_session_senc, p11_session_dek from gp_session where session_id=?", [id]);
        var rs = stmtRs.getResultSet();
        if (!rs.next()) {
            log.warn("no session for " + id);
            return { msgtype: "error", error: "No gp session for " + id};
        }
        
        // special handling for 'gp_extauth' response
    	var result = results.results[0];
        if (result.id === "gp_extauth") {
        	results.results.shift(); // remove from results
    		var nextStatus;
    		if (result.apdus && result.apdus.length === 1 && result.apdus[0] === "9000") {
    			nextStatus = "03_established";
    		} else {
        		nextStatus = "04_error";
        		log.warn("Error doing SCP02: " + JSON.stringify(result));
    		}
    		DB.update("update gp_session set last_accessed_at=?, status=? where session_id=? and status='02_initupdate'", [new java.util.Date(), nextStatus, id]);
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
                    rs.getInt("seq_counter"),
                    Hex.s2b(rs.getString("mac_iv")),
                    rs.getInt("p11_session_id"),
                    rs.getInt("p11_static_enc"),
                    rs.getInt("p11_static_mac"),
                    rs.getInt("p11_static_dek"),
                    rs.getInt("p11_session_cmac_des1"),
                    rs.getInt("p11_session_cmac_des3"),
                    rs.getInt("p11_session_senc"),
                    rs.getInt("p11_session_dek"));
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
            // check results contains only single gp_initupdate
        	if (results.results.length !== 1 || results.results[0].id !== "gp_initupdate" || !results.results[0].apdus || results.results[0].apdus.length !== 1) {
                return { msgtype: "error", error: "expected gp_initupdate result with single apdu, got: " + JSON.stringify(results)};
        	}
            result = results.results.shift(); // remove from results
        	var initupdateres = result.apdus[0];
        	var apdus = gp.externalAuthenticate(false, true, com.joelhockey.codec.Hex.s2b(hostChallenge), com.joelhockey.codec.Hex.s2b(initupdateres)); 
        	nextActions.actions.push({ id: "gp_extauth", name: "gp_extauth", apdus: apdus });
            DB.update(
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
where session_id=? and status='02_initupdate'", [
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
                DB.update("update gp_session set last_accessed_at=? where session_id=?", [java.util.Date(), id]);
        }
        
        // handle results
        for (var i = 0; i < results.results.length; i++) {
        	result = results.results[0];
        	var actionid = result.id;
      		var name = String(DB.selectStr("select name from action where id=? and status='02_executing'", [actionid]))
      		switch (name) {
      		case "getstatus":
      		    try {
          			gp.parseStatus(new com.joelhockey.smartcard.APDURes(result.apdus[0]),
          					new com.joelhockey.smartcard.APDURes(result.apdus[1]),
          					new com.joelhockey.smartcard.APDURes(result.apdus[2]));
      		    } catch (e) {
      		        log.error("error parsing getstatus", e.javaException || e.rhinoException || null);
      		    }
      			break;
      		default:
      			log.warn("unrecognised action name for response: " + name);
      			continue;
      		}
      		var count = DB.update("update action set status='03_complete' where id=? and status='02_executing'", [actionid]);
      		if (count !== 1) {
      			log.warn("Did not update results for action: " + actionid + " : " + name + ", must have been race condition");
      		}
        }
        
        stmtRs = DB.select(
"select id, version, aid, name, status from action where csn=? and status='01_ready' order by id",
[csn]);
            rs = stmtRs.getResultSet();
            while (rs.next()) {
                // add to result, update status
        	var actionid = rs.getInt("id");
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
                nextActions.actions.push({ id: actionid, name: name, apdus: apdus });
                break;
            default:
                log.error("unknown action name for request: [" + name + "]");
                break;
            }
            var count = DB.update("update action set status='02_executing' where id=? and status='01_ready'", [actionid]);
            if (count !== 1) {
                log.warn("Did not update request for action: " + actionid + " : " + name + ", must have been race condition");
            }
        }
        
        stmtRs.close();
        if (nextActions.actions.length === 0) {
            log.debug("all actions complete for session: " + id);
            nextActions.msgtype = "done";
        }
        return nextActions;
    }
};
