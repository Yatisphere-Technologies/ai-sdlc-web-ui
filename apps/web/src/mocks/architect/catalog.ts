import type { ArchBrief, Cloud } from "@throughline/contracts";

/**
 * Service catalogue the architect agent picks from. Each logical role maps to the real product on
 * each platform. The role key is also what the draw.io export uses to pick the vendor shape.
 */
export type ServiceRole =
  | "users"
  | "staff"
  | "internet"
  | "edge"
  | "waf"
  | "ddos"
  | "dns"
  | "apigw"
  | "ingress"
  | "ztna"
  | "kubernetes"
  | "serverless-containers"
  | "paas"
  | "functions"
  | "static-web"
  | "postgres"
  | "sqlserver"
  | "nosql"
  | "cache"
  | "queue"
  | "stream"
  | "object-store"
  | "secrets"
  | "hsm"
  | "workforce-idp"
  | "customer-idp"
  | "workload-identity"
  | "firewall"
  | "nat"
  | "private-endpoint"
  | "transit"
  | "vpn"
  | "private-circuit"
  | "bastion"
  | "dns-resolver"
  | "monitor"
  | "logs"
  | "siem"
  | "registry"
  | "cicd"
  | "llm"
  | "gpu"
  | "api-catalog"
  | "content-safety"
  | "agent-identity"
  | "language"
  | "search"
  | "datadog"
  | "grafana"
  | "onprem-dc"
  | "router"
  | "external"
  | "system";

type Names = Record<ServiceRole, string>;

const common = {
  users: "Users",
  staff: "Staff",
  internet: "Internet",
  "onprem-dc": "Corporate data centre",
  router: "Edge router",
  external: "External system",
  system: "System",
  datadog: "Datadog",
  grafana: "OpenTelemetry Collector + Grafana",
  cicd: "CI/CD pipeline",
  "static-web": "Static web hosting",
} as const;

export const CATALOG: Record<Cloud, Names> = {
  azure: {
    ...common,
    "static-web": "Azure Static Web Apps",
    edge: "Azure Front Door Premium",
    waf: "Front Door WAF policy",
    ddos: "Azure DDoS Network Protection",
    dns: "Azure DNS",
    apigw: "Azure API Management",
    ingress: "Application Gateway WAF v2",
    ztna: "Microsoft Entra Private Access",
    kubernetes: "Azure Kubernetes Service",
    "serverless-containers": "Azure Container Apps",
    paas: "Azure App Service",
    functions: "Azure Functions Premium",
    postgres: "Azure Database for PostgreSQL Flexible Server",
    sqlserver: "Azure SQL Database",
    nosql: "Azure Cosmos DB",
    cache: "Azure Cache for Redis",
    queue: "Azure Service Bus Premium",
    stream: "Azure Event Hubs",
    "object-store": "Azure Blob Storage",
    secrets: "Azure Key Vault",
    hsm: "Azure Key Vault Managed HSM",
    "workforce-idp": "Microsoft Entra ID",
    "customer-idp": "Microsoft Entra External ID",
    "workload-identity": "Entra Workload ID",
    firewall: "Azure Firewall Premium",
    nat: "Azure NAT Gateway",
    "private-endpoint": "Private Endpoint",
    transit: "VNet peering",
    vpn: "VPN Gateway (zone redundant)",
    "private-circuit": "ExpressRoute",
    bastion: "Azure Bastion",
    "dns-resolver": "DNS Private Resolver",
    monitor: "Azure Monitor",
    logs: "Log Analytics workspace",
    siem: "Microsoft Sentinel",
    registry: "Azure Container Registry",
    cicd: "Azure DevOps Pipelines",
    llm: "Azure OpenAI Service",
    gpu: "AKS GPU node pool",
    "api-catalog": "Azure API Center",
    "content-safety": "Azure AI Content Safety",
    "agent-identity": "Microsoft Entra Agent ID",
    language: "Azure AI Language (PII detection)",
    search: "Azure AI Search",
  },
  aws: {
    ...common,
    "static-web": "S3 + CloudFront",
    edge: "Amazon CloudFront",
    waf: "AWS WAF",
    ddos: "AWS Shield Advanced",
    dns: "Amazon Route 53",
    apigw: "Amazon API Gateway",
    ingress: "Application Load Balancer",
    ztna: "AWS Verified Access",
    kubernetes: "Amazon EKS",
    "serverless-containers": "Amazon ECS on Fargate",
    paas: "AWS Elastic Beanstalk",
    functions: "AWS Lambda",
    postgres: "Amazon Aurora PostgreSQL",
    sqlserver: "Amazon RDS for SQL Server",
    nosql: "Amazon DynamoDB",
    cache: "Amazon ElastiCache for Redis",
    queue: "Amazon SQS",
    stream: "Amazon MSK",
    "object-store": "Amazon S3",
    secrets: "AWS Secrets Manager + KMS",
    hsm: "AWS CloudHSM",
    "workforce-idp": "IAM Identity Center",
    "customer-idp": "Amazon Cognito",
    "workload-identity": "IAM roles for service accounts",
    firewall: "AWS Network Firewall",
    nat: "NAT Gateway",
    "private-endpoint": "VPC interface endpoint",
    transit: "AWS Transit Gateway",
    vpn: "AWS Site-to-Site VPN",
    "private-circuit": "AWS Direct Connect",
    bastion: "SSM Session Manager",
    "dns-resolver": "Route 53 Resolver",
    monitor: "Amazon CloudWatch",
    logs: "CloudWatch Logs",
    siem: "AWS Security Hub + GuardDuty",
    registry: "Amazon ECR",
    cicd: "GitHub Actions (OIDC)",
    llm: "Amazon Bedrock",
    gpu: "EKS GPU node group",
    "api-catalog": "API catalog (self-hosted)",
    "content-safety": "Amazon Bedrock Guardrails",
    "agent-identity": "Amazon Bedrock AgentCore Identity",
    language: "Amazon Comprehend (PII)",
    search: "Amazon OpenSearch Service",
  },
  gcp: {
    ...common,
    "static-web": "Cloud Storage + Cloud CDN",
    edge: "Cloud CDN + global load balancer",
    waf: "Cloud Armor",
    ddos: "Cloud Armor Enterprise",
    dns: "Cloud DNS",
    apigw: "Apigee",
    ingress: "Internal Application Load Balancer",
    ztna: "Identity-Aware Proxy",
    kubernetes: "Google Kubernetes Engine",
    "serverless-containers": "Cloud Run",
    paas: "App Engine",
    functions: "Cloud Run functions",
    postgres: "Cloud SQL for PostgreSQL",
    sqlserver: "Cloud SQL for SQL Server",
    nosql: "Firestore",
    cache: "Memorystore for Redis",
    queue: "Pub/Sub",
    stream: "Pub/Sub (ordered)",
    "object-store": "Cloud Storage",
    secrets: "Secret Manager",
    hsm: "Cloud HSM",
    "workforce-idp": "Cloud Identity",
    "customer-idp": "Identity Platform",
    "workload-identity": "Workload Identity Federation",
    firewall: "Cloud NGFW",
    nat: "Cloud NAT",
    "private-endpoint": "Private Service Connect",
    transit: "Network Connectivity Center",
    vpn: "HA VPN",
    "private-circuit": "Dedicated Interconnect",
    bastion: "IAP TCP forwarding",
    "dns-resolver": "Cloud DNS forwarding",
    monitor: "Cloud Monitoring",
    logs: "Cloud Logging",
    siem: "Security Command Center",
    registry: "Artifact Registry",
    cicd: "Cloud Build",
    llm: "Vertex AI",
    gpu: "GKE GPU node pool",
    "api-catalog": "Apigee API hub",
    "content-safety": "Model Armor",
    "agent-identity": "Agent identities (IAM service accounts)",
    language: "Sensitive Data Protection",
    search: "Vertex AI Search",
  },
  "on-prem": {
    ...common,
    "static-web": "NGINX static hosting",
    edge: "F5 BIG-IP (DMZ)",
    waf: "F5 Advanced WAF",
    ddos: "ISP DDoS scrubbing",
    dns: "Infoblox DNS",
    apigw: "Kong Gateway",
    ingress: "NGINX Ingress",
    ztna: "Zscaler Private Access",
    kubernetes: "Red Hat OpenShift",
    "serverless-containers": "OpenShift Serverless",
    paas: "OpenShift (S2I)",
    functions: "OpenShift Serverless Functions",
    postgres: "PostgreSQL 16 (Patroni HA)",
    sqlserver: "SQL Server Always On",
    nosql: "MongoDB Enterprise",
    cache: "Redis Enterprise",
    queue: "RabbitMQ (quorum queues)",
    stream: "Apache Kafka",
    "object-store": "MinIO object storage",
    secrets: "HashiCorp Vault",
    hsm: "Thales Luna HSM",
    "workforce-idp": "Active Directory + ADFS",
    "customer-idp": "Keycloak",
    "workload-identity": "Vault Kubernetes auth",
    firewall: "Palo Alto NGFW",
    nat: "Egress proxy",
    "private-endpoint": "Internal VIP",
    transit: "Core switching",
    vpn: "IPsec VPN",
    "private-circuit": "MPLS WAN",
    bastion: "CyberArk PAM jump host",
    "dns-resolver": "Internal DNS",
    monitor: "Prometheus",
    logs: "Elastic Stack",
    siem: "Splunk Enterprise Security",
    registry: "Harbor",
    cicd: "GitLab CI",
    llm: "vLLM on GPU servers",
    gpu: "GPU worker nodes",
    "api-catalog": "Backstage API catalog",
    "content-safety": "Self-hosted prompt-injection filter",
    "agent-identity": "Keycloak service accounts",
    language: "Microsoft Presidio",
    search: "OpenSearch",
  },
};

export const CLOUD_LABEL: Record<Cloud, string> = {
  azure: "Microsoft Azure",
  aws: "Amazon Web Services",
  gcp: "Google Cloud",
  "on-prem": "On-premises",
};

export const NETWORK_WORD: Record<Cloud, { network: string; subnet: string; sg: string }> = {
  azure: { network: "VNet", subnet: "Subnet", sg: "NSG" },
  aws: { network: "VPC", subnet: "Subnet", sg: "Security group" },
  gcp: { network: "VPC", subnet: "Subnet", sg: "Firewall policy" },
  "on-prem": { network: "Zone", subnet: "VLAN", sg: "Firewall rule" },
};

export type RegionPlan = {
  primary: string;
  dr: string | null;
  /** False when the cloud has no region in that geography: the data would leave the country. */
  inCountry: boolean;
  /** False when the only DR option is outside the geography. */
  drInCountry: boolean;
  zones: boolean;
};

/** Region facts as of mid-2026. The document tells readers to confirm them before committing. */
export const REGIONS: Record<Cloud, Record<ArchBrief["region"], RegionPlan>> = {
  azure: {
    india: {
      primary: "Central India (Pune)",
      dr: "South India (Chennai)",
      inCountry: true,
      drInCountry: true,
      zones: true,
    },
    uae: {
      primary: "UAE North (Dubai)",
      dr: "UAE Central (Abu Dhabi, restricted access)",
      inCountry: true,
      drInCountry: true,
      zones: true,
    },
    eu: {
      primary: "Germany West Central (Frankfurt)",
      dr: "West Europe (Amsterdam)",
      inCountry: true,
      drInCountry: true,
      zones: true,
    },
    us: {
      primary: "East US 2 (Virginia)",
      dr: "Central US (Iowa)",
      inCountry: true,
      drInCountry: true,
      zones: true,
    },
  },
  aws: {
    india: {
      primary: "ap-south-1 (Mumbai)",
      dr: "ap-south-2 (Hyderabad)",
      inCountry: true,
      drInCountry: true,
      zones: true,
    },
    uae: {
      primary: "me-central-1 (UAE)",
      dr: "me-south-1 (Bahrain)",
      inCountry: true,
      drInCountry: false,
      zones: true,
    },
    eu: {
      primary: "eu-central-1 (Frankfurt)",
      dr: "eu-west-1 (Ireland)",
      inCountry: true,
      drInCountry: true,
      zones: true,
    },
    us: {
      primary: "us-east-1 (N. Virginia)",
      dr: "us-west-2 (Oregon)",
      inCountry: true,
      drInCountry: true,
      zones: true,
    },
  },
  gcp: {
    india: {
      primary: "asia-south1 (Mumbai)",
      dr: "asia-south2 (Delhi)",
      inCountry: true,
      drInCountry: true,
      zones: true,
    },
    uae: {
      primary: "me-central1 (Doha)",
      dr: "me-central2 (Dammam)",
      inCountry: false,
      drInCountry: false,
      zones: true,
    },
    eu: {
      primary: "europe-west3 (Frankfurt)",
      dr: "europe-west4 (Netherlands)",
      inCountry: true,
      drInCountry: true,
      zones: true,
    },
    us: {
      primary: "us-east4 (N. Virginia)",
      dr: "us-central1 (Iowa)",
      inCountry: true,
      drInCountry: true,
      zones: true,
    },
  },
  "on-prem": {
    india: {
      primary: "Primary DC (Mumbai)",
      dr: "DR DC (Chennai)",
      inCountry: true,
      drInCountry: true,
      zones: false,
    },
    uae: {
      primary: "Primary DC (Dubai)",
      dr: "DR DC (Abu Dhabi)",
      inCountry: true,
      drInCountry: true,
      zones: false,
    },
    eu: {
      primary: "Primary DC (Frankfurt)",
      dr: "DR DC (Amsterdam)",
      inCountry: true,
      drInCountry: true,
      zones: false,
    },
    us: {
      primary: "Primary DC (Virginia)",
      dr: "DR DC (Texas)",
      inCountry: true,
      drInCountry: true,
      zones: false,
    },
  },
};

export const computeRole = (b: ArchBrief): ServiceRole => b.compute;
export const databaseRole = (b: ArchBrief): ServiceRole => b.database;
export const keyRole = (b: ArchBrief): ServiceRole => (b.keys === "hsm" ? "hsm" : "secrets");

/** Indicative monthly list price in USD for a production-sized footprint, zone redundant. */
export const MONTHLY_USD: Partial<Record<ServiceRole, number>> = {
  edge: 450,
  waf: 120,
  ddos: 2950,
  apigw: 2800,
  ingress: 350,
  ztna: 300,
  kubernetes: 1400,
  "serverless-containers": 650,
  paas: 600,
  functions: 450,
  postgres: 900,
  sqlserver: 2100,
  nosql: 800,
  cache: 450,
  queue: 700,
  stream: 900,
  "object-store": 60,
  secrets: 40,
  hsm: 2400,
  firewall: 1300,
  nat: 90,
  "private-endpoint": 60,
  transit: 150,
  vpn: 380,
  "private-circuit": 1150,
  bastion: 210,
  monitor: 350,
  logs: 650,
  siem: 700,
  registry: 170,
  llm: 600,
  gpu: 4200,
  datadog: 1100,
  grafana: 300,
  "customer-idp": 250,
  "api-catalog": 50,
  "content-safety": 300,
  language: 200,
  search: 750,
};
