/**
 * Created by Miguel Pazo (https://miguelpazo.com)
 */

import * as aws from "@pulumi/aws";
import * as config from "./config";

const domainsCdn = [];
const domains = [];

if (config.stack === 'dev') {
    domains.push('dev.domain.com');
    domains.push('api.domain.com');
}

if (config.stack === 'qa') {
    domainsCdn.push('qa.domain.com');
    domains.push('api-qa.domain.com');
}

if (config.stack === 'production') {
    domainsCdn.push('domain.com');
    domainsCdn.push('www.domain.com');
    domains.push('api.domain.com');
}

let result = [];

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

    /**
     *  Create a DNS record to prove that we _own_ the domain we're requesting a certificate for.
     *  See https://docs.aws.amazon.com/acm/latest/userguide/gs-acm-validate-dns.html for more info.
     */
    const certificateValidationDomain = new aws.route53.Record(`${domain}-validation`, {
        name: certificate.domainValidationOptions[0].resourceRecordName,
        zoneId: hostedZoneId,
        type: certificate.domainValidationOptions[0].resourceRecordType,
        records: [certificate.domainValidationOptions[0].resourceRecordValue],
        ttl: 60 * 60,
    });

    /**
     * This is a _special_ resource that waits for ACM to complete validation via the DNS record
     * checking for a status of "ISSUED" on the certificate itself. No actual resources are
     * created (or updated or deleted).
     */
    const certificateValidation = new aws.acm.CertificateValidation(`${domain}-certificateValidation`, {
        certificateArn: certificate.arn,
        validationRecordFqdns: [certificateValidationDomain.fqdn],
    }, {provider: provider});

    result.push({
        domain: domain,
        certificateArn: certificateValidation.certificateArn
    })
}

export const certificates = result;
