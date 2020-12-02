import { MendixSdkClient, OnlineWorkingCopy, Project, loadAsPromise } from 'mendixplatformsdk';
import { microflows } from 'mendixmodelsdk';
import when = require("when");

// Configuration
const config = {
    auth: {
        "username": "joe.robertson@first-consulting.co.uk",
        "apikey": "de41dd96-aeff-4249-b6fb-fc750005e9fa"
    },
    project: {
        "name": "FMO_ReferenceDataManagement",
        "id": "6d2c07d6-808f-4b21-bc81-1d35c041a7ff",
        "branch": "branchScriptTests"
    }
}

// Use with to get an SDK client
const client = new MendixSdkClient(config.auth.username, config.auth.apikey);

// Global integer to track any changes that I want to commit at the end
let changes = 0;

async function main() {
    const project = new Project(client, config.project.id, config.project.name);
    const workingCopy = await project.createWorkingCopy();
    processAllMicroflows(workingCopy);
}

function processMF(mf: microflows.Microflow, workingCopy: OnlineWorkingCopy) {
    // Loop through all Microflow objects that are Microflow activities
    mf.objectCollection.objects.filter(mfaction => mfaction.structureTypeName == 'Microflows$ActionActivity') //Change this to the text types that we want to change.
        .forEach(mfaction => {
            // We only want ActionActivities here because the others don't have a background colour


            if (mfaction instanceof microflows.ActionActivity) {
                // Get the action of the Activity to determine it's nature
                const activity = <microflows.ActionActivity>mfaction;
                const action = mfaction.action;

                /* If statement to check for each of the types of activities
                *  Check the colour matches, if not change it and increment the global changes integer 
                */
                if (action instanceof microflows.CreateVariableAction) {
                    if (activity.backgroundColor != microflows.ActionActivityColor.Yellow) {
                        activity.backgroundColor = microflows.ActionActivityColor.Yellow;
                        changes++;
                    }
                } else if (action instanceof microflows.ChangeListAction) {
                    if (activity.backgroundColor != microflows.ActionActivityColor.Blue) {
                        activity.backgroundColor = microflows.ActionActivityColor.Blue;
                        changes++;
                    }
                } else if (action instanceof microflows.DeleteAction) {
                    if (activity.backgroundColor != microflows.ActionActivityColor.Red) {
                        activity.backgroundColor = microflows.ActionActivityColor.Red;
                        changes++;
                    }
                } else if (action instanceof microflows.MicroflowCallAction) {
                    if (activity.backgroundColor != microflows.ActionActivityColor.Green) {
                        activity.backgroundColor = microflows.ActionActivityColor.Green;
                        changes++;
                    }
                } else if (action instanceof microflows.LogMessageAction) {
                    if (activity.backgroundColor != microflows.ActionActivityColor.Gray) {
                        activity.backgroundColor = microflows.ActionActivityColor.Gray;
                        changes++;
                    }
                }

                else {
                    activity.backgroundColor = microflows.ActionActivityColor.Default;
                }
            } else {
                console.info("Not an activity");
            }
        });
}

function loadAllMicroflowsAsPromise(microflows: microflows.IMicroflow[]): when.Promise<microflows.Microflow[]> {
    return when.all<microflows.Microflow[]>(microflows.map(mf => loadAsPromise(mf)));
}

async function processAllMicroflows(workingCopy: OnlineWorkingCopy) {
    loadAllMicroflowsAsPromise(workingCopy.model().allMicroflows())
        .then((microflows) => microflows.forEach((mf) => {
            processMF(mf, workingCopy);
        }))
        .done(async () => {
            // Once processing is done, if there are any changes, we commit the working copy
            if (changes > 0) {
                console.info("Done MF Processing, made " + changes + " change(s)");
                const revision = await workingCopy.commit();
            } else {
                console.info("No changes, skipping commit");
            }
        });
}

main();