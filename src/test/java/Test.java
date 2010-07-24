import com.joelhockey.jsunit.JSUnit;

public class Test {
    public static void main(String[] args) throws Exception {
        JSUnit.main("-basedir . test.js".split("\\s+"));
    }
}
