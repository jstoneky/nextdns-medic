#!/bin/bash
# Switch DNS to local Pi-hole (127.0.0.1)
# Detects active network interface automatically

PIHOLE_DNS="127.0.0.1"

# Find active interface (first one with a default route)
ACTIVE=$(networksetup -listallnetworkservices 2>/dev/null | grep -v "^\*\|^An " | while read svc; do
  ip=$(networksetup -getinfo "$svc" 2>/dev/null | grep "^IP address:" | awk '{print $3}')
  [ -n "$ip" ] && [ "$ip" != "none" ] && echo "$svc" && break
done)

if [ -z "$ACTIVE" ]; then
  echo "❌  Could not detect active network interface."
  exit 1
fi

echo "🔁  Setting DNS to Pi-hole ($PIHOLE_DNS) on: $ACTIVE"
sudo networksetup -setdnsservers "$ACTIVE" $PIHOLE_DNS
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder 2>/dev/null

echo "✅  DNS → Pi-hole. Verify: scutil --dns | grep nameserver"
echo "    Restore with: npm run dns:restore"
