import {MendixSdkClient, Project, OnlineWorkingCopy, Revision, Branch,loadAsPromise,} from 'mendixplatformsdk/dist';
import {JavaScriptSerializer, Structure, IStructure, StructuralUnit, IStructuralUnit, projects, constants, 
        javaactions, pages, domainmodels} from 'mendixmodelsdk/dist';
import when = require('when');
import {DemoApplication as config} from '../config' // Change this to change project
import fs = require('fs');import { domain } from 'process';
;
var path = require('path');

const client = new MendixSdkClient(config.auth.username, config.auth.apikey);
const project = new Project(client,config.project.id, config.project.name);
const revision = new Revision(-1, new Branch(project,config.project.branch)); // always use the latest revision

async function serialize(){
    const wc : OnlineWorkingCopy = await client.platform().createOnlineWorkingCopy(project, revision);
    
    // create the output folder
    const basePath = './out';
    if( !fs.existsSync(basePath)){
        fs.mkdirSync(basePath);    
    }

    const pageName = 'Page' //Change this to export different microflows

    await exportMicroflow (wc, basePath, pageName)
}

serialize();


async function exportMicroflow(wc : OnlineWorkingCopy, filePath : string, mfName:string){

    const pages = wc.model().allPages()
        const filteredPage = pages.filter (mf => {
                if (mf.name === mfName) {
                        return true
                }
                return false
        })

    for (const page of filteredPage) {
        const loadedDocument = await loadPageAsPromise(page);
        var filepath = getSanitisedAndUniqueFilePath (filePath, loadedDocument.name, '_')
        const serialised = JavaScriptSerializer.serializeToJs(loadedDocument);
        const entityRefs = getStructures (loadedDocument)

        
        for (var entityRef of entityRefs) {
            if (entityRef instanceof domainmodels.DirectEntityRef) {
                if (entityRef.entity != null) {
                    var  pageParameterEntityName = entityRef.entity.qualifiedName
                    console.log (pageParameterEntityName)
                }
                return
            }
        }

        // const layoutCall = loadedDocument.layoutCall
        // const loadedLayout = await loadLayoutCallAsPromise (layoutCall)
        // const arg = loadedLayout.arguments


        // for (var a of arg) {
        //     const widgets = a.widgets
        //     console.log (widgets.length)
        //     for (var widget of widgets) {
        //     // const widgetvalue = widget?.containerAsWidgetValue
        //     // const ent = widgetvalue?.entityPath
        //     console.log (widget.name)
        //     var dv = widget.containerAsDataView
        //     }

        // //    var par = await loadAsPromise (a.parameter)
        // //    console.log (par.qualifiedName)
        // }
        // // console.log (loadedDocument)>
        fs.writeFileSync(filepath,serialised );
    }
    console.log(`Page exported`);
}
    
function getSanitisedAndUniqueFilePath(basePath : string, filename : string | null, replaceValue : string, attempt : number = 1) : string {
    filename = filename || "";
    filename = filename.replace(/[/\\?%*:|"<>]/g, replaceValue);
    if(!filename.endsWith(".js")){
        filename += '.js';
    }
    let filePath = path.join(basePath, filename);

    if(fs.existsSync(filePath)){
        filename = filename + `${attempt}`;
        filePath = getSanitisedAndUniqueFilePath(basePath, filename, replaceValue, attempt++);
    }

    return filePath;
}

/**
* Traverses a given structure and returns all buttons, controlbar buttons and listviews
*/
function getStructures(structure: IStructure): IStructure[] {

    var structures: any[] = [];
    structure.traverse(function(structure) {
        if (structure instanceof domainmodels.DirectEntityRef)  {
            structures.push(structure);
        }
    });
    return structures;
}

// /**
// * This function processes a button and adds it to the jsonObj.
// */
// function processStructures(element, page: pages.Page, userRole: security.UserRole, calledFromMicroflow: boolean): when.Promise<void> {
//     if (page != null) {
//         if (calledFromMicroflow) {
//             var structures = getStructures(page);
//             if (!checkIfInElement(page.name, element)) {
//                 var child = { name: page.name, children: [], parent: element.name + ","+ element.parent };
//                 element["children"].push(child);
//                 if (structures.length > 0) {
//                     return when.all<void>(structures.map(strut => traverseElement(child, strut, userRole)));
//                 } else {
//                     return;
//                 }
//             }
//         } else {
//             if (checkPageSecurity(page, userRole)) {
//                 var structures = getStructures(page);
//                 if (!checkIfInElement(page.name, element)) {
//                     var child = { name: page.name, children: [], parent: element.name + ","+ element.parent };
//                     element["children"].push(child);
//                     if (structures.length > 0) {
//                         return when.all<void>(structures.map(strut => traverseElement(child, strut, userRole)));
//                     } else {
//                         return;
//                     }
//                 }
//                 else {
//                     return;
//                 }
//             } else {
//                 return;
//             }
//         }

//     } else {
//         return;
//     }
// }
// /**
// * This function traverses a page element
// */
// function traverseElement(element, structure: IStructure, userRole: security.UserRole): when.Promise<void> {
//     if (structure != null) {
//         if (structure instanceof pages.Button) {
//             return processButton(structure, element, userRole);
//         } else if (structure instanceof pages.ControlBarButton) {
//             return processControlBarButton(structure, element, userRole);
//         } else if (structure instanceof pages.ListView) {
//             return processListView(structure, element, userRole);
//         } else if (structure instanceof pages.SnippetCallWidget) {
//             return processSnippet(structure, element, userRole);
//         }
//     } else {
//         return;
//     }
// }





function loadPageAsPromise (page: pages.IPage): when.Promise<pages.Page> {
    return when.promise<pages.Page>((resolve, reject) => page.load(resolve));
}

function loadLayoutCallAsPromise (layoutCall: pages.ILayoutCall): when.Promise<pages.LayoutCall> {
    return when.promise<pages.LayoutCall>((resolve, reject) => layoutCall.load(resolve));
}

// function loadListOfLayoutArguments (layoutCallArguments: <IList>pages.LayoutCallArgument): when.Promise<pages.LayoutCallArgument[]> {
//     return when.all<pages.LayoutCallArgument[]>((resolve, reject) => layoutCallArguments.load(resolve));
// }

// function loadAllMicroflowsAsPromise(microflows: microflows.IMicroflow[]): when.Promise<microflows.Microflow[]> {
//     return when.all<microflows.Microflow[]>(microflows.map(mf => loadAsPromise(mf)));
// }

// async function processAllMicroflows(workingCopy: OnlineWorkingCopy) {
//     loadAllMicroflowsAsPromise(workingCopy.model().allMicroflows())
//         .then((microflows) => microflows.forEach((mf) => {
//             processMF(mf, workingCopy);
//         }))
//         .done(async () => {
//             // Once processing is done, if there are any changes, we commit the working copy
//             if (changes > 0) {
//                 console.info("Done MF Processing, made " + changes + " change(s)");
//                 const revision = await workingCopy.commit();
//             } else {
//                 console.info("No changes, skipping commit");
//             }
//         });
// }
