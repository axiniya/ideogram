var Ideogram = function(config) {

  this.config = config;

  /*
  this.config.chromosomes = config.chromosomes;
  this.config.chrWidth = config.chrWidth;
  this.config.chrHeight = config.chrHeight;
  this.config.chrMargin = config.chrMargin;
  this.config.showBandLabels = config.showBandLabels;
  this.config.orientation = config.orientation;
  */

  if (config.showBandLabels) {
    this.config.chrMargin += 20;
  }

  if (config.onLoad) {
    this.onLoadCallback = config.onLoad;
  }

  this.chromosomes = {};

  this.init();

}

Ideogram.prototype.getBands = function(content, chromosomeName) {
  // Gets chromosome band data from a TSV file

  var tsvLines = content.split(/\r\n|\n/);
  var lines = [];
  var columns, line, stain;
  // UCSC: #chrom chromStart  chromEnd  name  gieStain
  // http://genome.ucsc.edu/cgi-bin/hgTables
  //  - group: Mapping and Sequencing
  //  - track: Chromosome Band (Ideogram)
  //
  // NCBI: #chromosome  arm band  iscn_start  iscn_stop bp_start  bp_stop stain density
  // ftp://ftp.ncbi.nlm.nih.gov/pub/gdp/ideogram_9606_GCF_000001305.14_550_V1

  for (var i = 1; i < tsvLines.length - 1; i++) {

    columns = tsvLines[i].split("\t");

    if (columns[0] !== chromosomeName) {
      continue;
    }

    stain = columns[7];
    if (columns[8]) {
      // For e.g. acen and gvar, columns[8] (density) is undefined
      stain += columns[8];
    }

    line = {
      "chr": columns[0],
      "start": columns[5],
      "stop": columns[6],
      "iscnStart": columns[3],
      "iscnStop": columns[4],
      "name": columns[1] + columns[2],
      "stain": stain
    };

    lines.push(line);

  }

  return lines;

};


Ideogram.prototype.getChromosomeModel = function(bands, chromosomeName, scale) {

  var chr = {};
  var band;

  chr["id"] = "chr" + chromosomeName;
  chr["length"] = bands[bands.length - 1]["iscnStop"];

  var pxLeft = 0;

  for (var i = 0; i < bands.length; i++) {
    band = bands[i];
    bands[i]["pxWidth"] = scale * (band.iscnStop - band.iscnStart)/chr["length"];
    bands[i]["pxLeft"] = pxLeft;
    pxLeft += bands[i]["pxWidth"];
  }

  chr["pxWidth"] = pxLeft;
  chr["scale"] = scale;

  chr["bands"] = bands;

  return chr;
}


Ideogram.prototype.drawBandLabels = function(chr, model, chrIndex) {
  // Draws labels for cytogenetic band , e.g. "p31.2"

  var t0 = new Date().getTime();
  
  var chrMargin = (this.config.chrMargin + this.config.chrWidth) * chrIndex;

  chr.selectAll("text")
      .data(model.bands)
      .enter()
      .append("text")
        .attr("class", "bandLabel")
        .attr("x", function(d) { return -8 + d.pxLeft + d.pxWidth/2; })
        .attr("y", chrMargin - 10)
        .text(function(d) { return d.name; })
  
  chr.selectAll("line")
    .data(model.bands)
    .enter()
    .append("line")
      .attr("class", function(d) { return "bandLabelStalk " + d.name.replace(".", "-")  })
      .attr("x1", function(d) { return d.pxLeft + d.pxWidth/2; })
      .attr("y1", chrMargin)
      .attr("x2", function(d) { return d.pxLeft + d.pxWidth/2; })
      .attr("y2", chrMargin - 8)

  var overlappingLabelXRight = 0;

  $.each($("#" + model.id + " text:gt(0)"), function(index, element) {
    // Ensures band labels don't overlap

    var text = $(this),
        prevText = text.prev(),
        textPadding = 5;

    xLeft = text.offset().left;

    if (prevText.css("display") != "none") {
      prevLabelXRight = prevText.offset().left + prevText[0].getBBox().width;
    } 

    if (
      xLeft < overlappingLabelXRight + textPadding || 
      xLeft < prevLabelXRight + textPadding
    ) {
      
      text.hide();
      $("#" + model.id + " line.bandLabelStalk").eq(index + 1).hide();
      
      overlappingLabelXRight = prevLabelXRight;

    }

  });

  var t1 = new Date().getTime();
  console.log("Time in drawBandLabels: " + (t1 - t0) + " ms");

}


Ideogram.prototype.rotateBandLabels = function(chr, chrIndex) {

  console.log("Entered rotateBandLabels")

  var chrMargin, chrWidth;

  chrWidth = this.config.chrWidth;
  chrMargin = (this.config.chrMargin + chrWidth) * chrIndex;
  
  chr.selectAll("text.bandLabel")
    .attr("transform", "rotate(-90)")
    .attr("x", 8 - chrMargin)
    .attr("y", function(d) { return 2 + d.pxLeft + d.pxWidth/2; });

}


Ideogram.prototype.drawChromosome = function(model, chrIndex) {
  // Create SVG container

  var chr, chrWidth, pxWidth,
      pArmWidth, selector, qArmStart, qArmWidth;

  chr = d3.select("svg")
    .append("g")
      .attr("id", model.id);

  chrWidth = this.config.chrWidth;
  pxWidth = model.pxWidth;

  var chrMargin = (this.config.chrMargin + chrWidth) * chrIndex;

  chr.selectAll("path")   
    .data(model.bands)    
    .enter()
    .append("path")       
      .attr("id", function(d) { return d.name.replace(".", "-"); })
      .attr("class", function(d) { 
        var cls = d.stain;
        if (d.stain == "acen") {
          var arm = d.name[0]; // e.g. p in p11
          cls += " " + arm + "-cen";
        } 
        return cls;
      })
      .attr("d", function(d, i) {
        var x = d.pxWidth,
            left = d.pxLeft;

        if (d.stain == "acen") {
          x -= 4;
          if (d.name[0] == "p") {
            d = 
              "M " + (left) + " " + chrMargin + " " + 
              "l " + x + " 0 " + 
              "q 8 " + chrWidth/2 + " 0 " + chrWidth + " " + 
              "l -" + x + " 0 z";
          } else {
            d = 
              "M " + (left + x + 4) + " " + chrMargin + " " + 
              "l -" + x + " 0 " + 
              "q -8.5 " + chrWidth/2 + " 0 " + chrWidth + " " + 
              "l " + x + " 0 z";
          }
        } else {  

          if (i == 0) {
            left += 8;
          }

          d = 
            "M " + left + " " + chrMargin + " " + 
            "l " + x + " 0 " + 
            "l 0 " + chrWidth + " " + 
            "l -" + x + " 0 z";
        }

        return d;
      })

  if (this.config.showBandLabels === true) {
    this.drawBandLabels(chr, model, chrIndex);
  }
    
  chr.append('path')
    .attr("class", "p-ter chromosomeBorder " + model.bands[0].stain)
    .attr("d", "M 8 " + chrMargin + " q -8 " + (chrWidth/2) + " 0 " + chrWidth)

  chr.append('path')
    .attr("class", "q-ter chromosomeBorder " + model.bands[model.bands.length - 1].stain)
    .attr("d", "M " + pxWidth + " " + chrMargin + " q 8 " +  chrWidth/2 + " 0 " + chrWidth)

  // Why does human chromosome 11 lack a centromeric p-arm band?
  if ($("#" + model.id + " .p-cen").length > 0) {
    pArmWidth = $("#" + model.id + " .p-cen")[0].getBBox().x;
  } else {
    pArmWidth = $("#" + model.id + " .q-cen").prev()[0].getBBox().x;
  }
  
  qArmStart = $("#" + model.id + " .q-cen").next()[0].getBBox().x;
  qArmWidth = model.pxWidth - qArmStart;

  chr.append('line')
    .attr("class", "cb-p-arm-top chromosomeBorder")
    .attr('x1', "8")
    .attr('y1', chrMargin)
    .attr('x2', pArmWidth)
    .attr("y2", chrMargin)

  chr.append('line')
    .attr("class", "cb-p-arm-bottom chromosomeBorder")
    .attr('x1', "8")
    .attr('y1', chrWidth + chrMargin)
    .attr('x2', pArmWidth)
    .attr("y2", chrWidth + chrMargin)

  chr.append('line')
    .attr("class", "cb-q-arm-top chromosomeBorder")
    .attr('x1', qArmStart)
    .attr('y1', chrMargin)
    .attr('x2', qArmStart + qArmWidth)
    .attr("y2", chrMargin)

  chr.append('line')
    .attr("class", "cb-q-arm-bottom chromosomeBorder")
    .attr('x1', qArmStart)
    .attr('y1', chrWidth + chrMargin)
    .attr('x2', qArmStart + qArmWidth)
    .attr("y2", chrWidth + chrMargin)


  if (this.config.orientation == "vertical") {

    var chrMargin, chrWidth, tPadding;

    chrWidth = this.config.chrWidth;
    chrMargin = (this.config.chrMargin + chrWidth) * chrIndex;

    tPadding = chrMargin + (chrWidth-4)*(chrIndex-1);

    chr
      .attr("data-orientation", "vertical")
      .attr("transform", "rotate(90, " + (tPadding - 30) + ", " + (tPadding) + ")")

    this.rotateBandLabels(chr, chrIndex);

  } else {
    chr.attr("data-orientation", "horizontal")
  }

}


Ideogram.prototype.rotateAndToggleDisplay = function(chromosomeID) {
  // Rotates a chromosome 90 degrees and shows or hides all other chromosomes
  // Useful for focusing or defocusing a particular chromosome
  // TODO: Scale chromosome to better fill available SVG height and width

  var id, chr, chrIndex, chrMargin, tPadding,
      that = this;

  id = chromosomeID;
  
  chr = d3.select("#" + id);
  jqChr = $("#" + id);
  
  jqOtherChrs = $("g[id!='" + id + "']");

  chrIndex = jqChr.index() + 1;
  chrMargin = (this.config.chrMargin + this.config.chrWidth) * chrIndex;

  if (this.config.orientation == "vertical") {

    cx = chrMargin + (this.config.chrWidth-4)*(chrIndex-1) - 30;
    cy = cx + 30;
    verticalTransform = "rotate(90, " + cx + ", " + cy + ")";
    horizontalTransform = "rotate(0)translate(0, -" + (chrMargin - this.config.chrMargin) + ")";

  } else {

    var bandPad = 0;
    if (!this.config.showBandLabels) {
      bandPad += 10;
    }

    cx = 6 + chrMargin + (this.config.chrWidth - this.config.chrMargin - bandPad)*(chrIndex);
    cy = cx;
    verticalTransform = "rotate(90, " + cx + ", " + cy + ")";
    horizontalTransform = "";
    
  }

  if (jqChr.attr("data-orientation") != "vertical") {

    if (this.config.orientation == "horizontal") {
      jqOtherChrs.hide();
    }

    chr
      .attr("data-orientation", "vertical")
      .transition()
      .attr("transform", verticalTransform)
      .each("end", function() {
        
        that.rotateBandLabels(chr, chrIndex) 

        if (that.orientation == "vertical") {
          jqOtherChrs.show();
        }

      });

  } else {

    jqChr.attr("data-orientation", "");

    if (this.config.orientation == "vertical") {
      jqOtherChrs.hide();
    } 

    chr
      .transition()
      .attr("transform", horizontalTransform)
      .each("end", function() {
        
        chr.selectAll("text")
          .attr("transform", "")
          .attr("x", function(d) { return -8 + d.pxLeft + d.pxWidth/2; })
          .attr("y", chrMargin - 10)

        if (that.orientation == "horizontal") {
          jqOtherChrs.show();
        }
      
      });    

  }


}


Ideogram.prototype.convertBaseToOffset = function() {

}


Ideogram.prototype.drawSynteny = function(range1, range2) {
  // Draws a trapezoid connecting a genomic range on 
  // one chromosome to a genomic range on another chromosome;
  // a syntenic region

  
  var r1 = range1,
      r2 = range2,
      c1Box, c2Box,
      chr1Plane, chr2Plane, 
      polygon, 
      svg;

  c1Box = $("#" + r1.chr.id + " path")[0].getBBox();
  c2Box = $("#" + r2.chr.id + " path")[0].getBBox();
  
  chr1Plane = c1Box.y - 30
  chr2Plane = c2Box.y - 29;

  svg = d3.select("svg");

  svg.append("polygon")
    .attr("points",
      chr1Plane + ', ' + r1.start + ' ' + 
      chr1Plane + ', ' + r1.stop + ' ' + 
      chr2Plane + ', ' + r2.stop + ' ' +  
      chr2Plane + ', ' + r2.start 
      
    )
    .attr('style', "fill:#CFC")
  
  svg.append("line")
    .attr("x1", chr1Plane)
    .attr("x2", chr2Plane)
    .attr("y1", r1.start)
    .attr("y2", r2.start)
    .attr("style", "stroke:#AAA;stroke-width:1;")
    
  svg.append("line")
    .attr("x1", chr1Plane)
    .attr("x2", chr2Plane)
    .attr("y1", r1.stop)
    .attr("y2", r2.stop)
    .attr("style", "stroke:#AAA;stroke-width:1;")
  
}

Ideogram.prototype.onLoad = function() {
  // Called when Ideogram has finished initializing.
  // Accounts for certain ideogram properties not being set until 
  // asynchronous requests succeed, etc.

  call(this.onLoadCallback);

}

Ideogram.prototype.init = function() {

  $.ajax({
  //url: 'data/chr1_bands.tsv',
  url: 'data/ideogram_9606_GCF_000001305.14_550_V1',
  context: this,
  success: function(response) {
    var t0 = new Date().getTime();

    var chrs = this.config.chromosomes,
        i, chromosome, bands, chromosomeModel,
        bandArray, maxLength, scale, scales, chrLength;

    var svg = d3.select("body")
      .append("svg")
        .attr("id", "ideogram")
        .attr("width", "100%")
        .attr("height", chrs.length * this.config.chrHeight + 20)

    bandsArray = [];
    maxLength = 0;
    scales = [];

    for (i = 0; i < chrs.length; i++) {
      
      chromosome = chrs[i];
      bands = this.getBands(response, chromosome);
      bandsArray.push(bands);
      
      chrLength = parseInt(bands[bands.length - 1]["iscnStop"], 10);

      if (chrLength > maxLength) {
        maxLength = chrLength;
      }

      scale = this.config.chrHeight * chrLength/maxLength;
      scales.push(scale);
    }

    for (i = 0; i < chrs.length; i++) {
      bands = bandsArray[i];
      scale = scales[i];
      chromosome = chrs[i];
      chromosomeModel = this.getChromosomeModel(bands, chromosome, scale);
      
      this.chromosomes[chromosome] = chromosomeModel;

      this.drawChromosome(chromosomeModel, i + 1);
    }

    var t1 = new Date().getTime();
    console.log("Time constructing ideogram: " + (t1 - t0) + " ms")

    if (this.onLoadCallback) {
      this.onLoadCallback();
    }
  }
});

}
