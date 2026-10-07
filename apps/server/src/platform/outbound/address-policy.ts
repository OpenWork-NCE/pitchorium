import { BlockList, isIP } from 'node:net';

/**
 * Special-purpose ranges (IANA registries) never reached by outbound requests: loopback,
 * private, carrier-grade NAT, link-local, documentation, benchmarking, multicast, reserved,
 * unique local and IPv6 transition ranges that embed an IPv4 address.
 */
const BLOCKED = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  BLOCKED.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  BLOCKED.addSubnet(network, prefix, 'ipv6');
}

/**
 * True for a globally routable unicast address; anything else is refused (SSRF). IPv6 must be
 * in 2000::/3, which also excludes IPv4-mapped addresses (::ffff:0:0/96): that range is not in
 * the block list because BlockList also matches IPv4 addresses against it.
 */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return false;
  if (family === 6 && !/^[23]/i.test(address.replace(/^\[|\]$/g, ''))) {
    // Only global unicast 2000::/3 is routable on the Internet.
    return false;
  }
  return !BLOCKED.check(address, family === 4 ? 'ipv4' : 'ipv6');
}
