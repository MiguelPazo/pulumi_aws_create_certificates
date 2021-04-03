/**
 * Created by Miguel Pazo (https://miguelpazo.com)
 */

import * as pulumi from "@pulumi/pulumi";

const configPulumi = new pulumi.Config();

export const stack = pulumi.getStack();
export const generalTagName = configPulumi.get("generalTagName");
export const certificateCdnRegion = "us-east-1";
