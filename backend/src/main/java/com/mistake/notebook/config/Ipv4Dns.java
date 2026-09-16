package com.mistake.notebook.config;

import okhttp3.Dns;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Arrays;
import java.util.List;

/**
 * 只走 IPv4 解析。
 *
 * 本机网络没有可用的 IPv6 出口，OkHttp 默认会先试 AAAA 地址，
 * 每个都要等到 connectTimeout 才 NoRouteToHost，一次请求白等几分钟。
 * 大模型调用本来就慢，这里把不可用的地址族直接去掉。
 */
public final class Ipv4Dns implements Dns {

    public static final Ipv4Dns INSTANCE = new Ipv4Dns();

    private Ipv4Dns() {}

    @Override
    public List<InetAddress> lookup(String hostname) throws UnknownHostException {
        InetAddress[] all = InetAddress.getAllByName(hostname);
        List<InetAddress> v4 = Arrays.stream(all)
                .filter(a -> a instanceof Inet4Address)
                .toList();
        return v4.isEmpty() ? Arrays.asList(all) : v4;
    }
}
