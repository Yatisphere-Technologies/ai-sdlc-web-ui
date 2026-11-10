import type { ArchBrief } from "@throughline/contracts";
import { NETWORK_WORD } from "./catalog";

/** One row of the address plan: which network, which subnet, what lives there, what may talk to it. */
export type SubnetPlan = {
  key:
    | "firewall"
    | "gateway"
    | "bastion"
    | "dns"
    | "egress"
    | "ingress"
    | "app"
    | "data"
    | "endpoints"
    | "mgmt";
  network: "hub" | "spoke" | "dr";
  name: string;
  cidr: string;
  purpose: string;
  rules: string;
};

export type NetworkPlan = {
  hub: { name: string; cidr: string } | null;
  spoke: { name: string; cidr: string };
  dr: { name: string; cidr: string } | null;
  onprem: string | null;
  subnets: SubnetPlan[];
};

/**
 * Address plan for the chosen topology. Ranges never overlap each other or the on-prem range,
 * leave room to grow (/20 spokes) and respect each cloud's reserved subnet names and sizes.
 */
export function networkPlan(b: ArchBrief): NetworkPlan {
  const w = NETWORK_WORD[b.cloud];
  const hubSpoke = b.topology === "hub-spoke" && b.cloud !== "on-prem";
  const multiRegion = b.availability.startsWith("multi-region");
  const linked = b.connectivity !== "none";
  const az = b.cloud === "azure";
  const aws = b.cloud === "aws";
  const subnets: SubnetPlan[] = [];
  const net = hubSpoke ? "hub" : "spoke";
  const base = hubSpoke ? "10.0.0" : "10.1.6";

  if (b.cloud === "on-prem") {
    subnets.push(
      {
        key: "ingress",
        network: "spoke",
        name: "DMZ VLAN 110",
        cidr: "172.20.10.0/24",
        purpose: "Load balancers and WAF",
        rules: "Inbound 443 from internet scrubbing only",
      },
      {
        key: "app",
        network: "spoke",
        name: "App VLAN 120",
        cidr: "172.20.12.0/22",
        purpose: "OpenShift worker nodes",
        rules: "443 from DMZ; egress via proxy",
      },
      {
        key: "data",
        network: "spoke",
        name: "Data VLAN 130",
        cidr: "172.20.16.0/24",
        purpose: "Databases, cache, broker",
        rules: "DB ports from App VLAN only",
      },
      {
        key: "mgmt",
        network: "spoke",
        name: "Mgmt VLAN 140",
        cidr: "172.20.17.0/24",
        purpose: "PAM jump hosts, Vault, monitoring",
        rules: "SSH/RDP only via PAM",
      },
    );
    return {
      hub: null,
      spoke: { name: "Primary DC zones", cidr: "172.20.0.0/16" },
      dr: multiRegion ? { name: "DR DC zones", cidr: "172.21.0.0/16" } : null,
      onprem: null,
      subnets,
    };
  }

  subnets.push({
    key: "firewall",
    network: net,
    name: az ? "AzureFirewallSubnet" : aws ? "firewall-subnets (×3 AZ)" : "ngfw-endpoints",
    cidr: `${base}.0/26`,
    purpose: "Central egress and east-west inspection",
    rules: "All spoke egress forced here by route table (0.0.0.0/0)",
  });
  if (linked) {
    subnets.push({
      key: "gateway",
      network: net,
      name: az ? "GatewaySubnet" : aws ? "tgw-attachment-subnets" : "router-subnet",
      cidr: `${base}.64/27`,
      purpose: b.connectivity === "vpn" ? "Site-to-site VPN gateway" : "Private circuit gateway",
      rules: "BGP from on-prem; advertise only spoke ranges",
    });
  }
  subnets.push({
    key: "bastion",
    network: net,
    name: az ? "AzureBastionSubnet" : aws ? "ssm-endpoints" : "iap-range",
    cidr: `${base}.128/26`,
    purpose: "Privileged access without public IPs",
    rules: "No inbound from internet except the bastion service; JIT approvals",
  });
  if (linked) {
    subnets.push({
      key: "dns",
      network: net,
      name: az ? "snet-dns-inbound" : aws ? "resolver-subnets" : "dns-forwarding",
      cidr: `${base}.192/28`,
      purpose: "Hybrid DNS: on-prem resolves private endpoints",
      rules: "UDP/TCP 53 from on-prem resolvers",
    });
  }
  if (aws && hubSpoke) {
    subnets.push({
      key: "egress",
      network: "hub",
      name: "public-egress-subnets",
      cidr: "10.0.1.0/24",
      purpose: "NAT gateways for allow-listed egress",
      rules: "Outbound 443 to allow-listed destinations only",
    });
  }
  subnets.push(
    {
      key: "ingress",
      network: "spoke",
      name: aws ? "public-subnets (×3 AZ)" : az ? "snet-ingress" : "proxy-only-subnet",
      cidr: "10.1.0.0/24",
      purpose: b.exposure === "partner" ? "API gateway (internal mode)" : "Layer 7 load balancer with WAF",
      rules: "443 from edge service tag / partner IPs only",
    },
    {
      key: "app",
      network: "spoke",
      name: aws ? "private-app-subnets (×3 AZ)" : "snet-app",
      cidr: "10.1.2.0/23",
      purpose: "Service workloads",
      rules: `443 from ingress subnet; egress via firewall; ${w.sg} per workload`,
    },
    {
      key: "data",
      network: "spoke",
      name: aws ? "database-subnets (×3 AZ)" : "snet-data",
      cidr: "10.1.4.0/24",
      purpose: "Database and cache (no public access)",
      rules: "DB and cache ports from app subnet only",
    },
    {
      key: "endpoints",
      network: "spoke",
      name: aws ? "endpoint-subnets" : "snet-private-endpoints",
      cidr: "10.1.5.0/24",
      purpose: "Private endpoints for secrets, messaging, storage, registry",
      rules: "443 from app subnet; public network access disabled on every service",
    },
  );

  return {
    hub: hubSpoke ? { name: `hub-${w.network.toLowerCase()}`, cidr: "10.0.0.0/22" } : null,
    spoke: { name: `spoke-${w.network.toLowerCase()}`, cidr: "10.1.0.0/20" },
    dr: multiRegion ? { name: `dr-spoke-${w.network.toLowerCase()}`, cidr: "10.2.0.0/20" } : null,
    onprem: linked ? "172.16.0.0/12" : null,
    subnets,
  };
}
