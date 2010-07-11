

// anonymous function to keep global scope clean
(function() {

    // *****
    // set this value
    var version = 1;
    // ***** 


    var ic = new javax.naming.InitialContext();
    var DATASOURCE = ic.lookup("jdbc/deuce");
    var DB = com.joelhockey.cirrus.DB;
    var dbconn = DATASOURCE.getConnection();
    try {
        var dbversion;
        try {
            // get current version from 'db_version' table
            dbversion = DB.selectInt(dbconn, "select max(version) from db_version");
        } catch (e) {
            // error reading from 'db_version' table, try init script
            log("Error getting db version, will try and load init script", e);
            var stmt = dbconn.createStatement();
            var sql = readFile("/WEB-INF/db/000_init.sql");
            DB.insert("insert into db_version (version, created_at, desc, script) values (0, systimestamp, '000_init.sql', ?)", [sql]);
            stmt.execute(sql);
            stmt.close();
            dbversion = DB.selectInt(dbconn, "select max(version) from db_version");
        }
        
        // check if up to date
        if (dbversion === version) {
            log("already at expected version: " + version);
            return;
        } else if (dbversion > version) {
            // very strange
            throw new java.sql.SQLException("require version " + version + ", but db at: " + dbversion);
        }
        
        // move from dbversion to version
        log("doing db migration, current version: " + dbversion + ", app requires: " + version);
        
        // look in dir /WEB-INF/db to find required files
        var dbpath = sconf.getServletContext().getRealPath("/WEB-INF/db");
        if (dbpath == null) {
            throw new java.sql.SQLException("No path found for /WEB-INF/db");
        }
        var dbdir = new java.io.File(dbpath);
        if (!dbdir.isDirectory()) {
            throw new java.sql.SQLException("Could not find dir /WEB-INF/db, got: " + dbdir);
        }
        var files = dbdir.list();
        var fileMap = {};
        for (var i = 0; i < files.length; i++) {
            // check for filename format <nnn>_<desc>.sql
            if (/^\d{3}_.*\.sql$/.test(files[i])) {
                var filenum = parseInt(files[i].substring(0, 3));
                if (filenum > dbversion && filenum <= version) {
                    // check for duplicates
                    if (fileMap[filenum]) {
                        throw new java.sql.SQLException("Found duplicate file for migration: " + fileMap[filenum] + ", " + files[i]);
                    }
                    fileMap[filenum] = files[i];
                }
            }
        }
        
        // ensure all files exist
        for (var i = dbversion + 1; i <= version; i++) {
            if (!fileMap[i]) {
                throw new java.sql.SQLException("Migrating from: " + dbversion + " to: " + version + ", missing file: "
                    + i + ", got files: " + fileMap);
            }
        }

        // run scripts
        var stmt = dbconn.createStatement();
        for (var i = dbversion + 1; i <= version; i++) {
            log("running script: " + fileMap[i]);
            DB.insert("insert into db_version (version, created_at, desc, script) values (?, systimestamp, ?, ?)", [i, fileMap[i], sql]);
            var sql = readFile("/WEB-INF/db/" + fileMap[i]);
            stmt.execute(sql);
        }
        stmt.close();
        
    } finally {
        dbconn.close();
    }
})()

