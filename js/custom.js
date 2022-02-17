var $window = $(window);
var $root   = $('html, body');

$(document).ready(function ()
{
    "use strict";
    
    navbarToggler();
    smoothScroll();
    bgBackground();
    colorFull();
    borderColor();
    swiperSlider();
    submitForm();
});

$window.on("load", (function()
{
    $("#overlayer").delay(500).fadeOut('slow');
    $(".loader").delay(1000).fadeOut('slow');
    portfolioIsotop();
    headerSticky();
    scrollToAnchor();
}));

$window.on('scroll', function ()
{
    headerSticky();
});

/*-----------------------------------------------------------------------------
                                   FUNCTIONS
-----------------------------------------------------------------------------*/

/*--------------------------
       NAVBAR TOGGLER
--------------------------*/

function navbarToggler(){

    "use strict";

    $('.navbar-toggler').on('click', function()
    {
        $('header').toggleClass('z-index');
        $('.post-sidebar-toggle').toggleClass('d-none');
    })

}
/*-------------------------
        SMOOTH SCROLL
-------------------------*/
function smoothScroll(){

    "use strict";

    $('.header .navbar-nav a, .to-contact, .scroll-down a').on('click', function(event) {
        var $anchor = $(this);
        $root.stop().animate({
            scrollTop: $($anchor.attr('href')).offset().top - 60
        }, 1500, 'easeInOutQuart');
        event.preventDefault();
        $(".navbar-collapse").collapse('hide');
    });

    
}

/*-------------------------
        SCROLL TO
-------------------------*/

function scrollToAnchor(){
    //getting the anchor link in the URL and deleting the `#`
    var value =  window.location.hash.replace('');
    var sectionAnchor = value;
    var section = $(document).find(sectionAnchor);

    if(section.length > 0){
        $root.stop().animate({
            scrollTop: $(section).offset().top - 60
        }, 1500, 'easeInOutQuart');
    }
}

/*-------------------------
        HEADER STICKY
-------------------------*/
function headerSticky(){

    "use strict";

    if ($window.scrollTop() > 10) {
        $('#header').addClass('header-sticky');
    } else {
        $('#header').removeClass('header-sticky');
    }
}



/*-------------------------
        ColorFull Demo
-------------------------*/

function bgBackground() {

    "use strict";

    var list = document.getElementsByClassName('data-background');

    for (var i = 0; i < list.length; i++) {
        var color = list[i].getAttribute('data-color');
        list[i].style.backgroundColor = "" + color + "";
    }
}


     
function colorFull() {
    var allDivs = document.getElementsByClassName('data-text-color');

    for( var i =0; i < allDivs.length; ++i )
    {
        var color = allDivs[i].getAttribute('data-color');
        allDivs[i].style.color = "" + color + "";
    }
}


function borderColor() {
    var allDivs = document.getElementsByClassName('timeline-border');

    for( var i =0; i < allDivs.length; ++i )
    {
        var color = allDivs[i].getAttribute('data-color');
        allDivs[i].style.borderLeftColor = "" + color + "";
    }
}
   
/*-----------------------------
     HERO SWIPER SLIDER
------------------------------*/
function swiperSlider(){

    "use strict";

    if($(".swiper-container").length){
        var swiper = new Swiper('.swiper-container', {
            effect: "slide",
            allowTouchMove: 'false',
            touchRatio: 0,
            threshold: 992,
            autoplay: {
                delay: 5000,
            },
            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev',
            },
        });

        var textSwiper = new Swiper('.text-swiper', {
            effect: "fade",
            allowTouchMove: 'false',
            touchRatio: 0,
            threshold: 992,
            autoplay: {
                delay: 5000,
            },
            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev',
            },
        });

        $(".hero-item-image").css('background', function () {
            var bg = ('url(' + $(this).data("image-src") + ') no-repeat center');
            return bg;
        });
        var $fullscreen = $(".hero-04, .hero-swiper, .hero-text, .hero-images");
        $fullscreen.css("height", $window.height());
    }
}


/*-------------------------
        ISOTOPE JS
-------------------------*/
function portfolioIsotop() {

    "use strict";

    // init Isotope
    var initial_items = $('#showMore-initials').data("initial");
    var next_items = $('#showMore-initials').data("next");
    var $pfilter = $('#portfolio-filter');
    var $grid = $('.portfolio-items');
    var $showMore = $('#showMore');
    $grid.isotope({
        itemSelector: '.portfolio-item',
        layoutMode: 'masonry',
    });
    $pfilter.find('a').on("click",function() {
        var filterValue = $(this).attr('data-filter');
        $pfilter.find('a').removeClass('active');
        $(this).addClass('active');
        $grid.isotope({
            filter: filterValue,
        });
        updateFilterCounts();
        return false;
    });
    function updateFilterCounts() {
        var itemElems = $grid.isotope('getFilteredItemElements');
        var count_items = $(itemElems).length;
        if (count_items > initial_items) {
            $showMore.show();
            $showMore.parent('.button-border').addClass('mr-2 mr-sm-4').removeClass('p-0');
            
        } else {
            $showMore.hide();
            $showMore.parent('.button-border').removeClass('mr-2 mr-sm-4').addClass('p-0');
        }
        if ($('.portfolio-item').hasClass('visible_item')) {
            $('.portfolio-item').removeClass('visible_item');
        }
        var index = 0;

        $(itemElems).each(function() {
            if (index >= initial_items) {
                $(this).addClass('visible_item');
            }
            index++;
        });
        $grid.isotope('layout');
    }
    function showNextItems(pagination) {
        var itemsMax = $('.visible_item').length;
        var itemsCount = 0;
        $('.visible_item').each(function() {
            if (itemsCount < pagination) {
                $(this).removeClass('visible_item');
                itemsCount++;
            }
        });
        if (itemsCount >= itemsMax) {
            $showMore.hide();
            $showMore.parent('.button-border').removeClass('mr-2 mr-sm-4').addClass('p-0');
        }
        $grid.isotope('layout');
    }
    // function that hides items when page is loaded
    function hideItems(pagination) {
        var itemsMax = $('.portfolio-item').length;
        var itemsCount = 0;
        $('.portfolio-item').each(function() {
            if (itemsCount >= pagination) {
                $(this).addClass('visible_item');
            }
            itemsCount++;
        });
        if (itemsCount < itemsMax || initial_items >= itemsMax) {
            $showMore.hide();
            $showMore.parent('.button-border').removeClass('mr-2 mr-sm-4').addClass('p-0');
        }
        $grid.isotope('layout');
    }
    $showMore.on('click', function(e) {
        e.preventDefault();
        showNextItems(next_items);
    });
hideItems(initial_items);
}

function submitForm()
{
    "use strict";

    $('form').on('submit', function(e)
    {
        e.preventDefault();

        var message = $('form textarea').val();
    
        if(message != '')
        {
            window.open('https://wa.me/+994773339800?text=' + encodeURI(message), '_blank');
        }
    
        else
        {
            iziToast.error(
            {
                title: 'Error',
                message: 'Message field is required',
                position: 'topRight'
            });
        }
    });
}

$(function ()
{
    $('#wpBtn').floatingWhatsApp(
    {
        popupMessage: 'Hi , how can I help you ?',
        backgroundColor: 'transparent',
    });

    $('#wpBtn textarea').attr('rows', 4);
});