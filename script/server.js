// add jetty to classpath
var addURL = java.net.URLClassLoader.__javaObject__.getDeclaredMethod("addURL", [java.net.URL]);
addURL.accessible = true;
var jettydir = new java.io.File("jetty");
for each (var file in jettydir.listFiles().concat(jettydir)) {
    addURL.invoke(java.lang.ClassLoader.getSystemClassLoader(), [file.toURL()]);
}
print("Starting jetty on port 8080\nCtrl-C to exit");
var server = new org.mortbay.jetty.Server();
var connector=new org.mortbay.jetty.nio.SelectChannelConnector();
connector.setPort(8080);
server.setConnectors([connector]);
webapp = new org.mortbay.jetty.webapp.WebAppContext();
webapp.setContextPath("/");
webapp.setWar("./src/main/webapp");
var classLoader = new org.mortbay.jetty.webapp.WebAppClassLoader(webapp);
classLoader.addClassPath("target/classes");
classLoader.addJars(org.mortbay.resource.Resource.newResource("lib/compile"));
classLoader.addJars(org.mortbay.resource.Resource.newResource("lib/runtime"));
webapp.setClassLoader(classLoader)
server.setHandler(webapp);

// logging
var requestLogHandler = new org.mortbay.jetty.handler.RequestLogHandler();
var requestLog = new org.mortbay.jetty.NCSARequestLog("logs/jetty-yyyy_mm_dd.request.log");
requestLog.setRetainDays(90);
requestLog.setAppend(true);
requestLog.setExtended(false);
requestLog.setLogTimeZone("GMT");
requestLogHandler.setRequestLog(requestLog);
server.addHandler(requestLogHandler);

server.start();
server.join();
