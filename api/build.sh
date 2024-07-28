#!/bin/bash
# TODO: Transfer to Magefile? https://magefile.org

# create bin directory
mkdir -p out/bin

# build the go function in pickupgamesapi and name it bootstrap
echo "Building pickupgamesapi..."
cd pickupgamesapi
GOOS=linux GOARCH=amd64 go build -o bootstrap
cd ..
echo "Pacakging pickupgamesapi to zip..."
zip -j out/bin/pickupgamesapi.zip pickupgamesapi/bootstrap
echo "Built pickupgamesapi..."

# No longer building out Java Lambda as it's no longer used
# echo "Building signuplambda..."
# cd signuplambda/signups
# mvn clean package
# cd ../..
# mv signuplambda/signups/target/signups.jar out/bin/signups.jar
# aws s3 cp out/bin/signups.jar s3://$1/signups-artifacts/signups.jar

echo "Publishing artifacts..."
aws s3 cp out/bin/pickupgamesapi.zip s3://$1/pickupgames-auth-artifacts/pickupgamesapi.zip
