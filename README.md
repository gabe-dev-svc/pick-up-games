# Pick Up Games Project

## Purpose

I organize and am a part of several groups of people who regularly play pick-up soccer. The purpose here is to create a REST API that can be integrated with either an app or a group chat bot or another interface to streamline soccer sign-ups. Wrangling people's payments should be simplified using Stripe, the Cash App API, Venmo API, and/or other payment APIs. Still TBD.

## Project Organization

This is hosted on AWS Lambda considering the low-cost. The `lambda` directory holds all the "business" logic, and the `infra` directory holds all the infrastructure (AWS CDK) code.

As this project grows, I'll probably split up the different projects into separate repositories, but for now I'm choosing to keep it all in one because this project is also meant to be showcased as a part of my "portfolio", or at the very least to demonstrate that I can develop some code and infrastructure.

## Decisions and Notes

### Choosing registration API semantics

For game registrations, I was torn between two sets of API paths. First, I considered taking a more direct/literal approach to "joining" and "dropping" from games, using the `PATCH` verb since the only attribute being modified were the `roster` and `waitList` attributes. 

- `PATCH /games/{gameID}/join`
- `PATCH /games/{gameID}/drop`

However, I opted for a more RESTful pattern considering the act of joining and dropping creates a relationship between the caller and the game (a "registration"), and opted to use the more conventional `POST` and `DELETE` HTTP verbs. 

- `POST /games/{gameID}/registration`
- `DELETE /games/{gameID}/registration`

Another consideration which I've opted to not include is that of including a `participant `path variable/request parameter (`POST /games/{gameID}/registration/?participant=email@test.com`) as I want to keep game registrations as very intentional and don't consider
the act of a game owner/host to be in scope.