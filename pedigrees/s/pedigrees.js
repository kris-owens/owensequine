
function init() {
    initData();

    app.selectedTabIndex = ko.observable(0);
    app.goatsFilter = new GoatsFilter(app.data.goats);
    app.breedersFilter = new BreedersFilter(app.data.breeders);
    app.selectedGoatId = ko.observable();
    app.selectedBreederId = ko.observable();
    app.selectedGoat = ko.pureComputed(() => {
        return _.find(app.data.goats, { Id: app.selectedGoatId() });
    }, this);
    app.selectedBreeder = ko.pureComputed(() => {
        return _.find(app.data.breeders, { Id: app.selectedBreederId() });
    }, this);

    function setPath() {
        const hash = _.trim(location.hash);

        if (hash.length === 0) {
            return;
        }

        const kvp = hash.split('=');

        switch (kvp[0]) {
            case '#p':
                app.selectedTabIndex(0);
                app.selectedGoatId(kvp[1]);

                break;
            case '#m':
                app.selectedTabIndex(1);
                app.selectedBreederId(kvp[1]);

                break;
        }
    }

    window.addEventListener('hashchange', function () {
        app.selectedBreederId(undefined);
        app.selectedGoatId(undefined);

        setPath();
    }, false);

    ko.applyBindings(app);``

    setPath();
}

function initData() {
    app.data = data;
    app.maxLineageDepth = 4;
    app.maxFullTileDepth = 4;

    app.data.breeders = _(data.breeders).map(b => new Breeder(b)).sortBy('LastName').value();
    app.data.goats = _(data.pedigree).map(p => new Goat(p)).sortBy('Name').value();

    _.forEach(app.data.goats, goat => {
        goat.Sire = _.find(app.data.goats, { Id: goat.SireId });
        goat.Dam = _.find(app.data.goats, { Id: goat.DamId });
    });

    _.forEach(app.data.goats, goat => {
        goat.Children = _.filter(app.data.goats, g => g.Sire === goat || g.Dam === goat);
    });

    _.forEach(app.data.goats, goat => {
        goat.Siblings = _.filter(app.data.goats, g => g.Sire === goat.Sire && g.Dam === goat.Dam && g !== goat);
    });


    // _.forEach(app.data.goats, goat => {
    //     goat.Lineage = {
            
    //     };

    //     // const parents = {
    //     //     Sire
    //     // };

    //     // goat.Ancestors = [];

    //     // if()
    // });

    _.forEach(app.data.breeders, breeder => {
        breeder.Goats = _.filter(app.data.goats, p => p.Owner === breeder || p.Breeder === breeder);
    });
}

// function getLineage(goat) {
//     const lineage = {
//         Ancestors: [],
//         Siblings: goat.Children,
//         Descendants: [],
//     };
//     let sire = goat.Sire;
//     let dam = goat.Dam;

//     while(sire) {

//     }

//     return lineage;
// }

function Breeder(json) {
    _.defaults(this, json);

    this.Id = this.MemberID;
    this.Name = `${this.FirstName} ${this.LastName}`;
}
Breeder.prototype.containsString = function (input) {
    return containsString(this.Name, input);
};

function Goat(json) {
    _.defaults(this, json);

    this.Id = this.PedigreeId;
    this.OwnerId = this.Owner;
    this.BreederId = this.Breeder;

    this.Owner = this.Owner === '0'
        ? undefined
        : _.find(app.data.breeders, { ADGAMmbrID: this.Owner });

    this.Breeder = this.Breeder === '0'
        ? undefined
        : _.find(app.data.breeders, { ADGAMmbrID: this.Breeder });

    this.SexFormatted = this.Sex === 'M' ? 'Male' : this.Sex === 'F' ? 'Female' : 'Unknown';
    this.DeadFormatted = this.Dead === 'Dead' ? 'No' : 'Yes';

    this.DOBFormatted = this.DOB === null || this.DOB == '0000-00-00' ? '' : new Date(this.DOB).toLocaleDateString();

    this.Description = `${formatString(this.SexFormatted, `${this.SexFormatted} `)}${formatString(this.DOBFormatted, `born ${this.DOBFormatted} `)}${formatString(this.RegNo, `(${this.RegNo})`)}`;
    this.ShortDescription = `${formatString(this.Sex, `${this.Sex} `)}${this.DOBFormatted}${formatString(this.RegNo, `, ${this.RegNo}`)}`;

    if (app.data.photos.indexOf(this.Photo) < 0) {
        this.Photo = undefined;
    } else {
        const dir = app.data.photomap[this.Photo];

        if(dir) {
            this.Photo = `https://images.squarespace-cdn.com/content/62e46f55add2c66fea7bfeec/${dir}/${this.Photo}`;
        }
    }

    function formatString(value, formattedValue) {
        if(value == null || value.length === 0) {
            return '';
        }

        return formattedValue;
    }
}
Goat.prototype.containsString = function (input) {
    return (this.Owner && this.Owner.containsString(input))
        || (this.Breeder && this.Breeder.containsString(input))
        || containsString(this.OwnerId, input)
        || containsString(this.BreederId, input)
        || containsString(this.Name, input);
};
Goat.prototype.getAllDescendants = function() {
    const descendants = [];

    function addGeneration(generation, parent) {
        const nextGeneration = [];
        descendants.push(nextGeneration);

        //_.forEach(parents, parent => {
            _.forEach(parent.Children, child => {
                generation.push(child);

                addGeneration(nextGeneration, child);
            });
        //});
    }

    const firstGeneration = [];
    descendants.push(firstGeneration);

    addGeneration(firstGeneration, this);

    return descendants;
};

function GoatsFilter(itemsSource) {
    this.itemsSource = itemsSource;
    this.input = ko.observable().extend({ rateLimit: { timeout: 500, method: 'notifyWhenChangesStop' } });
    this.items = ko.pureComputed(() => {
        return filterItems(this.itemsSource, this.input());
    }, this);
}

function BreedersFilter(itemsSource) {
    this.itemsSource = itemsSource;
    this.input = ko.observable().extend({ rateLimit: { timeout: 500, method: 'notifyWhenChangesStop' } });
    this.items = ko.pureComputed(() => {
        return filterItems(this.itemsSource, this.input());
    }, this);
}

function filterItems(items, input) {
    input = _.trim(input).toLowerCase();

    if (input.length > 0) {
        return _.filter(items, item => {
            return item.containsString(input);
        });
    }

    return items;
}

function containsString(value, input) {
    return value
        && value.toLowerCase().indexOf(input) >= 0;
}

window.app = {};
window.onload = init;