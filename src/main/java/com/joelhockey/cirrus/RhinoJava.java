/**
 * Original code from:
 * http://weblog.raganwald.com/2007/07/javascript-on-jvm-in-fifteen-minutes.html
 *
 * Updates from Joel Hockey:
 * The MIT Licence
 *
 * Copyright 2010 Joel Hockey (joel.hockey@gmail.com).  All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
package com.joelhockey.cirrus;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.mozilla.javascript.NativeArray;
import org.mozilla.javascript.NativeJavaArray;
import org.mozilla.javascript.NativeObject;
import org.mozilla.javascript.ScriptableObject;

/**
 * Convert between Java String, List, Map and Rhino NativeString, NativeArray, NativeObject
 *
 * @author http://weblog.raganwald.com/2007/07/javascript-on-jvm-in-fifteen-minutes.html
 * @author Joel Hockey
 */

public class RhinoJava {
    public static Object wrapNative(ScriptableObject scope, Object obj) {
        if (obj instanceof String) {
            return obj;
        } else if (obj instanceof Map) {
            return wrapMap(scope, (Map) obj);
        } else if (obj instanceof List) {
            return wrapArray(scope, (List) obj);
        } else if (obj instanceof byte[] || obj instanceof char[] ||  obj instanceof short[] || obj instanceof int[] || obj instanceof long[]) {
            return new NativeJavaArray(scope, obj);
        } else if (obj instanceof Object[]) {
            return wrapArray(scope, Arrays.asList(obj));
        }
        return obj;
    }

    public static NativeObject wrapMap(ScriptableObject scope, Map map) {
        NativeObject no = new NativeObject();
        for (Iterator it = map.entrySet().iterator(); it.hasNext(); ) {
            Map.Entry entry = (Map.Entry) it.next();
            no.defineProperty(entry.getKey().toString(), wrapNative(scope, entry.getValue()), ScriptableObject.EMPTY);
        }
        return no;
    }

    public static NativeArray wrapArray(ScriptableObject scope, List list) {
        NativeArray na = new NativeArray(list.size());
        for (int i = 0; i < list.size(); i++) {
            na.put(i, scope, wrapNative(scope, list.get(i)));
        }
        return na;
    }

    public static List unwrapNativeArray(final NativeArray na) {
        return new ArrayList() {{
            for (int i = 0; i < na.getLength(); ++i) {
                add(unwrapNative(na.get(i, null)));
            }
        }};
    }

    public static Map<String, Object> unwrapObject (final ScriptableObject sObj) {
        return new LinkedHashMap<String, Object> () {{
            for (int i = 0; i < sObj.getAllIds().length; i++) {
                put(sObj.getAllIds()[i].toString(), unwrapNative(sObj.get(sObj.getAllIds()[i].toString(), null)));
            }
        }};
    }

    public static Object unwrapNative (final Object obj) {
        if (obj instanceof NativeString || obj instanceof String) {
            return obj.toString();
        } else if (obj instanceof NativeArray) {
            return unwrapNativeArray((NativeArray) obj);
        } else if (obj instanceof NativeJavaArray) {
            return ((NativeJavaArray) obj).unwrap();
        } else if (obj instanceof ScriptableObject) {
            return unwrapObject((ScriptableObject) obj);
        } else {
            return obj;
        }
    }
}
