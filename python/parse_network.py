import ipaddress
import json
import re
import sys
from collections import defaultdict


def clean_value(value):
    return value.strip().strip('"').strip("'")


def create_device(name):
    return {
        "name": name,
        "deviceName": name,
        "type": "unknown",
        "deviceType": "unknown",
        "role": "edge",
        "managementIp": None,
        "mgmt_ip": None,
        "interfaces": [],
        "vlans": [],
        "bgp_neighbors": [],
        "acl_rules": [],
        "routing_protocols": [],
    }


def parse_single_config(config_name, config_text):
    device = create_device(clean_value(config_name or "device"))
    lines = [line.rstrip() for line in config_text.splitlines()]
    current_interface = None
    addresses = defaultdict(list)
    validation = {
        "hasErrors": False,
        "duplicateIps": [],
        "gatewayIssues": [],
        "vlanIssues": [],
        "bgpIssues": [],
        "aclIssues": [],
        "routingIssues": [],
    }

    def register_ip(ip_value, owner_label):
        base_ip = ip_value.split("/")[0]
        addresses[base_ip].append(owner_label)

    for raw_line in lines:
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        lower_line = line.lower()

        if lower_line.startswith("hostname "):
            value = clean_value(line.split(None, 1)[1])
            device["name"] = value
            device["deviceName"] = value
        elif lower_line.startswith("type "):
            value = clean_value(line.split(None, 1)[1]).lower()
            device["type"] = value
            device["deviceType"] = value
        elif lower_line.startswith("role "):
            device["role"] = clean_value(line.split(None, 1)[1]).lower()
        elif lower_line.startswith("mgmt-ip ") or lower_line.startswith("management-ip "):
            value = clean_value(line.split(None, 1)[1])
            device["managementIp"] = value
            device["mgmt_ip"] = value
            register_ip(value, f"mgmt:{device['name']}")
        elif lower_line.startswith("interface "):
            interface_name = clean_value(line.split(None, 1)[1])
            current_interface = {
                "name": interface_name,
                "ip": None,
                "gateway": None,
                "vlans": [],
                "links": [],
            }
            device["interfaces"].append(current_interface)
        elif current_interface and lower_line.startswith("ip address "):
            value = clean_value(line.split(None, 2)[2])
            current_interface["ip"] = value
            register_ip(value, f"iface:{device['name']}:{current_interface['name']}")
            try:
                ipaddress.ip_interface(value)
            except ValueError:
                validation["routingIssues"].append(f"Invalid interface IP: {value}")
                validation["hasErrors"] = True
        elif current_interface and lower_line.startswith("gateway "):
            current_interface["gateway"] = clean_value(line.split(None, 1)[1])
        elif lower_line.startswith("vlan "):
            parts = line.split()
            if len(parts) > 1 and parts[1].isdigit():
                vlan_id = int(parts[1])
                if not 1 <= vlan_id <= 4094:
                    validation["vlanIssues"].append(
                        f"VLAN {vlan_id} is out of range (1-4094)",
                    )
                    validation["hasErrors"] = True
                if vlan_id not in device["vlans"]:
                    device["vlans"].append(vlan_id)
                if current_interface and vlan_id not in current_interface["vlans"]:
                    current_interface["vlans"].append(vlan_id)
        elif current_interface and lower_line.startswith("link "):
            value = clean_value(line.split(None, 1)[1])
            link_parts = value.split()
            if len(link_parts) >= 2:
                peer_device = link_parts[0]
                peer_interface = link_parts[1]
                current_interface["links"].append(
                    {
                        "peerDevice": peer_device,
                        "peerInterface": peer_interface,
                    },
                )
        elif lower_line.startswith("bgp neighbor "):
            neighbor_ip = clean_value(line.split(None, 2)[2])
            device["bgp_neighbors"].append(neighbor_ip)
            try:
                ipaddress.ip_address(neighbor_ip)
            except ValueError:
                validation["bgpIssues"].append(
                    f"Invalid BGP neighbor IP: {neighbor_ip}",
                )
                validation["hasErrors"] = True
        elif lower_line.startswith("access-list "):
            match = re.match(r"access-list\s+(\d+)\s+(permit|deny)\s+(.+)", line, re.I)
            if match:
                acl_rule = {
                    "number": match.group(1),
                    "action": match.group(2).lower(),
                    "details": match.group(3).strip(),
                }
                device["acl_rules"].append(acl_rule)
                if acl_rule["action"] == "permit" and "any any" in acl_rule["details"].lower():
                    validation["aclIssues"].append(
                        f"ACL {acl_rule['number']}: permit any any detected",
                    )
        elif lower_line in {"ospf", "eigrp", "rip", "bgp"}:
            protocol = lower_line.upper()
            if protocol not in device["routing_protocols"]:
                device["routing_protocols"].append(protocol)

    duplicate_ips = []
    for ip_value, owners in addresses.items():
        unique_owners = sorted(set(owners))
        if len(unique_owners) > 1:
            duplicate_ips.append({"ip": ip_value, "devices": unique_owners})

    validation["duplicateIps"] = duplicate_ips

    gateway_issues = []
    for interface in device["interfaces"]:
        ip_value = interface.get("ip")
        gateway_value = interface.get("gateway")
        if not ip_value or not gateway_value:
            continue
        try:
            interface_network = ipaddress.ip_interface(ip_value).network
            gateway_address = ipaddress.ip_address(gateway_value)
            if gateway_address not in interface_network:
                gateway_issues.append(
                    {
                        "device": device["name"],
                        "interface": interface["name"],
                        "gateway": gateway_value,
                        "expectedSubnet": str(interface_network),
                        "actualIp": ip_value,
                    },
                )
        except ValueError:
            gateway_issues.append(
                {
                    "device": device["name"],
                    "interface": interface["name"],
                    "gateway": gateway_value,
                    "expectedSubnet": "invalid",
                    "actualIp": ip_value,
                },
            )

    validation["gatewayIssues"] = gateway_issues

    if device["bgp_neighbors"] and "BGP" not in device["routing_protocols"]:
        validation["routingIssues"].append(
            "BGP neighbors configured but BGP is missing from routing protocols",
        )

    if (
        validation["duplicateIps"]
        or validation["gatewayIssues"]
        or validation["vlanIssues"]
        or validation["bgpIssues"]
        or validation["aclIssues"]
        or validation["routingIssues"]
    ):
        validation["hasErrors"] = True

    summary = {
        "interfaces": len(device["interfaces"]),
        "vlans": len(device["vlans"]),
        "bgpNeighbors": len(device["bgp_neighbors"]),
        "aclRules": len(device["acl_rules"]),
        "routingProtocols": device["routing_protocols"],
        "hasErrors": validation["hasErrors"],
    }

    return {"device": device, "validation": validation, "summary": summary}


def parse_multiple_configs(configs):
    devices = []
    links = []
    vlan_members = defaultdict(set)
    ip_index = defaultdict(list)

    for config in configs:
        parsed = parse_single_config(config.get("name", "device"), config.get("text", ""))
        device = parsed["device"]
        devices.append(device)

        if device.get("managementIp"):
            ip_index[device["managementIp"].split("/")[0]].append(device["name"])

        for interface in device["interfaces"]:
            if interface.get("ip"):
                ip_index[interface["ip"].split("/")[0]].append(device["name"])

            for vlan_id in interface.get("vlans", []):
                vlan_members[vlan_id].add(device["name"])

            for link in interface.get("links", []):
                links.append(
                    {
                        "source": device["name"],
                        "sourceInterface": interface["name"],
                        "target": link["peerDevice"],
                        "targetInterface": link["peerInterface"],
                    },
                )

        for vlan_id in device["vlans"]:
            vlan_members[vlan_id].add(device["name"])

    duplicate_ips = []
    for ip_value, owners in ip_index.items():
        unique_owners = sorted(set(owners))
        if len(unique_owners) > 1:
            duplicate_ips.append({"ip": ip_value, "devices": unique_owners})

    validation = {
        "hasErrors": bool(duplicate_ips),
        "duplicateIps": duplicate_ips,
        "gatewayIssues": [],
        "vlanIssues": [],
        "bgpIssues": [],
        "aclIssues": [],
        "routingIssues": [],
    }

    unique_links = []
    seen_links = set()
    for link in links:
        link_key = tuple(
            sorted(
                [
                    f"{link['source']}::{link['sourceInterface']}",
                    f"{link['target']}::{link['targetInterface']}",
                ],
            ),
        )
        if link_key in seen_links:
            continue
        seen_links.add(link_key)
        unique_links.append(link)

    vlan_list = [
        {"id": vlan_id, "devices": sorted(device_names)}
        for vlan_id, device_names in sorted(vlan_members.items(), key=lambda item: item[0])
    ]

    return {
        "devices": devices,
        "links": unique_links,
        "vlans": vlan_list,
        "validation": validation,
        "metrics": {
            "deviceCount": len(devices),
            "linkCount": len(unique_links),
            "vlanCount": len(vlan_list),
            "duplicateIpCount": len(duplicate_ips),
            "gatewayIssueCount": 0,
            "bgpIssueCount": 0,
            "aclIssueCount": 0,
            "routingIssueCount": 0,
        },
    }


def main():
    payload = json.load(sys.stdin)

    if payload.get("config"):
        result = parse_single_config(payload.get("name", "device"), payload.get("config", ""))
    else:
        result = parse_multiple_configs(payload.get("configs", []))

    json.dump(result, sys.stdout)


if __name__ == "__main__":
    main()
