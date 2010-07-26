// use anonymous function to keep global namespace clean
(function() {
    // setup DATASOURCE
    var ds = new org.hsqldb.jdbc.jdbcDataSource();
    ds.setDatabase("jdbc:hsqldb:./hsqldb/deuce");
    ds.setUser("sa");

    ic = new javax.naming.InitialContext();
    ic.addToEnvironment("jdbc/deuce", ds);

    // load cirrus
    load("WEB-INF/app/cirrus.js");
})();

