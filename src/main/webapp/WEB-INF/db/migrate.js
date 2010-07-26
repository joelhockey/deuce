

// anonymous function to keep global scope clean
(function() {

    // *****
    // set this value
    var version = 1;
    // ***** 


    // load cirrus
    load("WEB-INF/app/cirrus.js");
    var dbconn = DATASOURCE.getConnection();
    try {
        var dbversion;
        try {
            // get current version from 'db_version' table
            dbversion = DB.selectInt(dbconn, "select max(version) from db_version");
        } catch (e) {
            // error reading from 'db_version' table, try init script
            log.warn("Error getting db version, will try and load init script: " + e);
            var stmt = dbconn.createStatement();
            var sql = readFile("/WEB-INF/db/000_init.sql");
            stmt.execute(sql);
            stmt.close();
            DB.insert(dbconn, "insert into db_version (version, filename, script) values (0, '000_init.sql', ?)", [sql]);
            dbversion = DB.selectInt(dbconn, "select max(version) from db_version");
        }
        
        // check if up to date
        var msg = "db at version: " + dbversion + ", app requires version: " + version;
        if (dbversion === version) {
            log.info("db version ok.  " + msg);
            return;
        } else if (dbversion > version) { // very strange
            throw new java.sql.SQLException(msg);
        }
        
        // move from dbversion to version
        log.info("doing db migration.  " + msg);
        
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
            log.info("db migration running script: " + fileMap[i]);
            var sql = readFile("/WEB-INF/db/" + fileMap[i]);
            DB.insert(dbconn, "insert into db_version (version, filename, script) values (?, ?, ?)", [i, fileMap[i], sql]);
            stmt.execute(sql);
        }
        stmt.close();
        
    } finally {
        dbconn.close();
    }
})()

