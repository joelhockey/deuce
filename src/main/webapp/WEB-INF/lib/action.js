
LIB.action = {
    // switch between start and results
    getActions: function (id, data) {
        switch (data.msgtype) {
        case "start":
            return this.startActions(id, data);
        case "results":
            return this.getNextActions(id, data);
        default:
            return {msgtype: "error", error: "unknown msgtype: [" + data.msgtype + "]"};
        }
    },
    
    // start new session
    startActions: function (id, data) {
        // ensure iin, cin, csn included
        if (!data.iin || !data.cin || !data.csn) {
            return {msgtype: "error", error: 
                printf("Invalid start request, require iin, cin, csn.  Got iin=%s, cin=%s, csn=%s",
                       data.iin, data.cin, data.csn)};
        }
        var dbconn = DATASOURCE.getConnection();
        try {
            var hostChallenge = com.joelhockey.codec.Buf.substring(null, 0, 8);
            new java.security.SecureRandom().nextBytes(hostChallenge);
            var count = DB.insert(dbconn,
"insert into gp_session (session_id, last_accessed_at, iin, cin, csn, status, host_challenge) \
  ( select ?, ?, ?, ?, ?, '02_initupdate', ? from dual where not exists \
    ( select null from gp_session where session_id=? ) \
  )",
                    [id, new java.util.Date(), data.iin, data.cin, data.csn, hostChallenge, id]);
            if (count === 0) {
                return {msgtype: "error", error: "session already started for id: " + id};
            }
            var apdus = new com.joelhockey.globalplatform.Messages().initializeUpdate(0, hostChallenge);
            return {msgtype: "actions", actions: [{id: "gp_initupdate", apdus: apdus}]}
        } catch (e) {
            log.error("Error in startActions", e.javaException || e.rhinoException || null);
            return {msgtype: "error", error: "could not start actions: " + e};
        } finally {
            dbconn.close();
        }
    },
    
    // get next actions to send
    getNextActions: function (id, results) {
        // get gp session details from DB, ensure scp02 started
        // once gp session is running, send actions
        var dbconn = DATASOURCE.getConnection();
        try {
            // get gp session
            var stmtRs = DB.select(dbconn, "select iin, cin, csn, status, host_challenge, enc, mac, seq_counter, mac_iv, p11_slot_id, p11_session_id, p11_static_enc, p11_static_mac, p11_static_dek, p11_session_cmac_des1, p11_session_cmac_des3, p11_session_senc, p11_session_dek from gp_session where session_id=?", [id]);
            var rs = stmtRs.getResultSet();
            if (!rs.next()) {
                log.warn("no session for " + id);
                return {msgtype: "error", error: "No gp session for " + id};
            }
            
            // create P11Crypto object if needed
            var p11crypto = null;
            var csn = rs.getString("csn");
            var status = rs.getString("status");
            switch (status) {
                case "02_initupdate":
                    p11crypto = new com.joelhockey.globalplatform.P11Crypto("GP", null, "password", "isk");
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
            stmtRs.close();
            var gp = com.joelhockey.globalplatform.Messages(p11crypto, enc, mac);
            
            // update last_accessed_at
            DB.update(dbconn, "update gp_session set last_accessed_at=? where session_id=?", [java.util.Date(), id]);
            
            // result holds all apdus
            var result = {msgtype: "actions", actions: []};
            
            // if gp status is '02_initupdate', then complete with extauth
            if (status === "02_initupdate") {
                // TODO: check results contains only single gp_initupdate
                result.actions.push({id: "gp_extauth", apdus: gp.externalAuthenticate(false, true, Hex.s2b(rs.getString("host_challenge")))});
                DB.update(dbconn, "update gp_session set last_accessed_at=?, status='03_established', enc=?, mac=?, seq_counter=?, mac_iv=?, p11_slot_id=?, p11_session_id=?, p11_static_enc=?, p11_static_mac=?, p11_static_dek=?, p11_session_cmac_des1=?, p11_session_cmac_des3=?, p11_session_senc=?, p11_session_dek=? where session_id=? and status='02_init_update'",
                    [java.util.Date(), gp.useEncrypt(), gp.useMAC(), p11crypto.getSeqCounter(), p11crypto.getMacIV(), p11crypto.getSlotID(), p11crypto.getSession(), p11crypto.getStaticENC(), p11crypto.getStaticMAC(), p11crypto.getStaticDEK(), p11crypto.getSessionCMACdes1(), p11crypto.getSessionCMACdes3(), p11crypto.getSessionSENC(), p11crypto.getSessionDEK(), id]);
            } else {
                DB.update(dbconn, "update gp_session set last_accessed_at=? where session_id=?", [java.util.Date(), id]);
            }
            
            // TODO: handle results
            
            stmtRs = DB.select(dbconn, "select id, version, aid, name, status from action where csn=? and status='01_ready' order by id", [csn]);
            rs = stmtRs.getResultSet();
            while (rs.next()) {
                // add to result, update status
                var name = rs.getString("name");
                switch (name) {
                case "getstatus":
                    var apdus = gp.getStatus();
                    result.actions.push({id: rs.getString("id"), apdus: gp.getstatus()});
                    break;
                default:
                    log.error("unknown action name: " + name);
                    break;
                }
                DB.update();
            }
            
            stmtRs.close();
            return result;
        } finally {
            conn.close();
        }
        
    }
};