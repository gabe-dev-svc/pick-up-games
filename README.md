# Pick Up Games Project

## Purpose

I organize and am a part of several groups of people who regularly play pick-up soccer. The purpose here is to create a REST API that can be integrated with either an app or a group chat bot or another interface to streamline soccer sign-ups. Wrangling people's payments should be simplified using Stripe, the Cash App API, Venmo API, and/or other payment APIs. Still TBD.

## Project Organization

This is hosted on AWS Lambda considering the low-cost. The `lambda` directory holds all the "business" logic, and the `infra` directory holds all the infrastructure (AWS CDK) code.

As this grows the organization will change, but for now the Lambda is just 