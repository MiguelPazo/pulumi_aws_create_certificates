/**
 * Created by Miguel Pazo (https://miguelpazo.com)
 */
import * as aws from "@pulumi/aws";
import * as config from "./config";

const domainsCdn = [];
const domains = [];

switch (config.stack) {
    case 'app1_dev':
        domains.push(`auth-dev.${config.targetDomain}`);
        domains.push(`auth2-dev.${config.targetDomain}`);
        break;

    case 'app1_qa':
        domains.push(`auth-qa.${config.targetDomain}`);
        break;

    case 'app1_production':
        domainsCdn.push(`auth.${config.targetDomain}`);
        domains.push(`auth-api.${config.targetDomain}`);
        break;
}

let result = {};

const providerUs = new aws.Provider("provider-us", {
    profile: aws.config.profile,
    region: config.certificateCdnRegion,
});

const providerDefault = new aws.Provider("provider-default", {
    profile: aws.config.profile,
    region: aws.config.region,
});

for (let i in domainsCdn) {
    createCertificate(domainsCdn[i], providerUs);
}

for (let i in domains) {
    createCertificate(domains[i], providerDefault);
}

function createCertificate(domain: string, provider: aws.Provider) {
    const certificate = new aws.acm.Certificate(`${domain}-certificate`, {
        domainName: domain,
        validationMethod: "DNS",
        tags: {
            Name: `${domain}-certificate`,
            [config.generalTagName]: "shared",
        }
    }, {provider: provider});

    const hostedZoneId = aws.route53.getZone({name: `${domain}.`}, {async: true}).then(zone => zone.zoneId);

    const certificateValidationDomain = new aws.route53.Record(`${domain}-validation`, {
        name: certificate.domainValidationOptions[0].resourceRecordName,
        zoneId: hostedZoneId,
        type: certificate.domainValidationOptions[0].resourceRecordType,
        records: [certificate.domainValidationOptions[0].resourceRecordValue],
        ttl: 60 * 60,
    });

    const certificateValidation = new aws.acm.CertificateValidation(`${domain}-certificateValidation`, {
        certificateArn: certificate.arn,
        validationRecordFqdns: [certificateValidationDomain.fqdn],
    }, {provider: provider});

    result[domain] = certificateValidation.certificateArn;
}

export {result}
