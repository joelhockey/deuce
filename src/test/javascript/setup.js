// use anonymous function to keep global namespace clean
(function() {
    // setup DATASOURCE
    var ds = new org.hsqldb.jdbc.jdbcDataSource();
    ds.setDatabase("jdbc:hsqldb:file:hsqldb/deuce;shutdown=true");
    ds.setUser("sa");

    // global 'DB'
    DB = new com.joelhockey.cirrus.DB(ds);

    // load cirrus
    load("WEB-INF/app/cirrus.js");
})();

