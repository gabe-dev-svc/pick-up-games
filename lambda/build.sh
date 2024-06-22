#!/bin/bash
# TODO: Transfer to Magefile? https://magefile.org

# create bin directory
mkdir -p out/bin

# build the go function in pickupgamesapi and name it bootstrap
cd pickupgamesapi
GOOS=linux go build -o bootstrap
cd ..

# zip the built function and move the zip archive to the out/bin directory
zip -j out/bin/pickupgamesapi.zip pickupgamesapi/bootstrap