#!/bin/bash
# Restore DNS to automatic (DHCP) — removes manual Pi-hole override

ACTIVE=$(networksetup -listallnetworkservices 2>/dev/null | grep -v "^\*\|^An " | while read svc; do
  ip=$(networksetup -getinfo "$svc" 2>/dev/null | grep "^IP address:" | awk '{print $3}')
  [ -n "$ip" ] && [ "$ip" != "none" ] && echo "$svc" && break
done)

if [ -z "$ACTIVE" ]; then
  echo "❌  Could not detect active network interface."
  exit 1
fi

echo "🔁  Restoring DNS to automatic (DHCP) on: $ACTIVE"
sudo networksetup -setdnsservers "$ACTIVE" empty
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder 2>/dev/null

echo "✅  DNS restored. Current servers:"
scutil --dns | grep "nameserver\[0\]" | head -3
